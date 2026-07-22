
-- Sugestão de menu (importador pode gravar aqui; NÃO afeta o menu do site)
ALTER TABLE public.temas ADD COLUMN IF NOT EXISTS sugestao_menu BOOLEAN NOT NULL DEFAULT false;

-- Log de mesclas de temas (irreversível)
CREATE TABLE IF NOT EXISTS public.tema_merge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  principal_id UUID NOT NULL,
  principal_nome TEXT NOT NULL,
  secundarios JSONB NOT NULL,
  matérias_movidas INTEGER NOT NULL DEFAULT 0,
  executado_por UUID,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tema_merge_log TO authenticated;
GRANT ALL ON public.tema_merge_log TO service_role;

ALTER TABLE public.tema_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tema_merge_log_staff_read" ON public.tema_merge_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "tema_merge_log_staff_write" ON public.tema_merge_log
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Função de mescla: move vínculos de secundários para o principal e apaga os secundários.
-- Retorna: total de matérias movidas (vínculos novos criados no principal).
CREATE OR REPLACE FUNCTION public.mesclar_temas(_principal UUID, _secundarios UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _movidas INTEGER := 0;
  _principal_nome TEXT;
  _secs JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _principal IS NULL OR _secundarios IS NULL OR array_length(_secundarios,1) IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos';
  END IF;
  IF _principal = ANY(_secundarios) THEN
    RAISE EXCEPTION 'O tema principal não pode estar entre os secundários';
  END IF;

  SELECT nome INTO _principal_nome FROM public.temas WHERE id = _principal;
  IF _principal_nome IS NULL THEN RAISE EXCEPTION 'Tema principal não encontrado'; END IF;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'slug', slug))
    INTO _secs FROM public.temas WHERE id = ANY(_secundarios);

  -- Insere vínculos que ainda não existem
  WITH ins AS (
    INSERT INTO public.post_temas (post_id, tema_id)
    SELECT DISTINCT pt.post_id, _principal
    FROM public.post_temas pt
    WHERE pt.tema_id = ANY(_secundarios)
      AND NOT EXISTS (
        SELECT 1 FROM public.post_temas x
        WHERE x.post_id = pt.post_id AND x.tema_id = _principal
      )
    RETURNING 1
  )
  SELECT count(*) INTO _movidas FROM ins;

  -- Apaga os secundários (cascade limpa post_temas restante)
  DELETE FROM public.temas WHERE id = ANY(_secundarios);

  INSERT INTO public.tema_merge_log (principal_id, principal_nome, secundarios, matérias_movidas, executado_por)
  VALUES (_principal, _principal_nome, COALESCE(_secs, '[]'::jsonb), _movidas, auth.uid());

  RETURN _movidas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mesclar_temas(UUID, UUID[]) TO authenticated;
