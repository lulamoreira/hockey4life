
CREATE OR REPLACE FUNCTION public.autor_estatisticas(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _autor_id uuid;
  _total bigint;
  _primeiro_ano int;
  _ultimo_ano int;
  _times_count bigint;
  _por_ano jsonb;
BEGIN
  SELECT id INTO _autor_id FROM public.autores WHERE slug = _slug;
  IF _autor_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*),
    min(extract(year FROM publicado_em)::int),
    max(extract(year FROM publicado_em)::int)
  INTO _total, _primeiro_ano, _ultimo_ano
  FROM public.posts
  WHERE autor_id = _autor_id
    AND status = 'publicado'
    AND publicado_em <= now();

  SELECT count(DISTINCT pt.tema_id) INTO _times_count
  FROM public.post_temas pt
  JOIN public.temas t ON t.id = pt.tema_id AND t.tipo = 'time'
  JOIN public.posts p ON p.id = pt.post_id
  WHERE p.autor_id = _autor_id
    AND p.status = 'publicado'
    AND p.publicado_em <= now();

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.ano), '[]'::jsonb) INTO _por_ano
  FROM (
    SELECT extract(year FROM publicado_em)::int AS ano, count(*)::int AS total
    FROM public.posts
    WHERE autor_id = _autor_id
      AND status = 'publicado'
      AND publicado_em <= now()
    GROUP BY 1
    ORDER BY 1
  ) x;

  RETURN jsonb_build_object(
    'total', COALESCE(_total, 0),
    'primeiro_ano', _primeiro_ano,
    'ultimo_ano', _ultimo_ano,
    'times_count', COALESCE(_times_count, 0),
    'por_ano', COALESCE(_por_ano, '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.autor_estatisticas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.autor_estatisticas(text) TO anon, authenticated;
