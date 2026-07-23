
-- Sorteia uma matéria publicada aleatória
CREATE OR REPLACE FUNCTION public.sortear_post(_excluir_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, titulo text, slug text, chapeu text, resumo text, imagem_capa text, publicado_em timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.titulo, p.slug, p.chapeu, p.resumo, p.imagem_capa, p.publicado_em
  FROM public.posts p TABLESAMPLE SYSTEM (5)
  WHERE p.status = 'publicado'
    AND p.publicado_em <= now()
    AND (_excluir_id IS NULL OR p.id <> _excluir_id)
  ORDER BY random()
  LIMIT 1;
$$;

-- Fallback: se TABLESAMPLE não retornou linha (tabelas pequenas), usar random tradicional
CREATE OR REPLACE FUNCTION public.sortear_post_seguro(_excluir_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, titulo text, slug text, chapeu text, resumo text, imagem_capa text, publicado_em timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.titulo, p.slug, p.chapeu, p.resumo, p.imagem_capa, p.publicado_em
    FROM public.posts p TABLESAMPLE SYSTEM (5)
    WHERE p.status = 'publicado'
      AND p.publicado_em <= now()
      AND (_excluir_id IS NULL OR p.id <> _excluir_id)
    ORDER BY random()
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT p.id, p.titulo, p.slug, p.chapeu, p.resumo, p.imagem_capa, p.publicado_em
      FROM public.posts p
      WHERE p.status = 'publicado'
        AND p.publicado_em <= now()
        AND (_excluir_id IS NULL OR p.id <> _excluir_id)
      ORDER BY random()
      LIMIT 1;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.sortear_post(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_post_seguro(uuid) TO anon, authenticated;

-- Índice para "Neste dia" — extrai dia/mês em America/Sao_Paulo
CREATE INDEX IF NOT EXISTS posts_publicado_em_sp_diames_idx
  ON public.posts (
    (extract(month FROM (publicado_em AT TIME ZONE 'America/Sao_Paulo'))),
    (extract(day   FROM (publicado_em AT TIME ZONE 'America/Sao_Paulo')))
  )
  WHERE status = 'publicado';

-- Retorna matérias publicadas com o mesmo dia/mês (fuso SP) em anos anteriores
CREATE OR REPLACE FUNCTION public.neste_dia(
  _hoje date DEFAULT NULL,
  _vizinhos int DEFAULT 0,
  _limite int DEFAULT 6
)
RETURNS TABLE(
  id uuid, titulo text, slug text, chapeu text, resumo text,
  imagem_capa text, publicado_em timestamptz, ano int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base date := COALESCE(_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  _ano_atual int := extract(year FROM _base)::int;
  _viz int := GREATEST(0, LEAST(_vizinhos, 3));
  _lim int := GREATEST(1, LEAST(_limite, 20));
BEGIN
  RETURN QUERY
  WITH datas AS (
    SELECT (_base + (g || ' days')::interval)::date AS d
    FROM generate_series(-_viz, _viz) g
  )
  SELECT p.id, p.titulo, p.slug, p.chapeu, p.resumo, p.imagem_capa, p.publicado_em,
         extract(year FROM (p.publicado_em AT TIME ZONE 'America/Sao_Paulo'))::int AS ano
  FROM public.posts p
  JOIN datas dt ON
        extract(month FROM (p.publicado_em AT TIME ZONE 'America/Sao_Paulo'))::int = extract(month FROM dt.d)::int
    AND extract(day   FROM (p.publicado_em AT TIME ZONE 'America/Sao_Paulo'))::int = extract(day   FROM dt.d)::int
  WHERE p.status = 'publicado'
    AND p.publicado_em <= now()
    AND extract(year FROM (p.publicado_em AT TIME ZONE 'America/Sao_Paulo'))::int < _ano_atual
  ORDER BY p.publicado_em ASC
  LIMIT _lim;
END $$;

GRANT EXECUTE ON FUNCTION public.neste_dia(date, int, int) TO anon, authenticated;
