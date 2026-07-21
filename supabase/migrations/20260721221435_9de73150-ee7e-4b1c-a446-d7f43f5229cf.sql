
CREATE OR REPLACE FUNCTION public.listar_arquivo(
  _q text DEFAULT '',
  _tema_ids uuid[] DEFAULT NULL,
  _ano int DEFAULT NULL,
  _mes int DEFAULT NULL,
  _ordem text DEFAULT 'desc',
  _page int DEFAULT 1,
  _per_page int DEFAULT 12
)
RETURNS TABLE(
  id uuid, titulo text, slug text, resumo text,
  imagem_capa text, credito_imagem text, publicado_em timestamptz,
  rank real, trecho text, total bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query tsquery;
  _off int := GREATEST(0, (_page - 1) * _per_page);
  _lim int := GREATEST(1, LEAST(50, _per_page));
  _qclean text := COALESCE(trim(_q), '');
  _has_temas boolean := (_tema_ids IS NOT NULL AND array_length(_tema_ids, 1) IS NOT NULL);
BEGIN
  IF _qclean = '' THEN
    _query := NULL;
  ELSE
    BEGIN
      _query := websearch_to_tsquery('public.pt_unaccent', _qclean);
    EXCEPTION WHEN OTHERS THEN
      _query := plainto_tsquery('public.pt_unaccent', _qclean);
    END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.titulo, p.slug, p.resumo, p.imagem_capa, p.credito_imagem,
           p.publicado_em, p.conteudo,
           CASE WHEN _query IS NULL THEN 0::real ELSE ts_rank(p.busca_tsv, _query) END AS rank
    FROM posts p
    WHERE p.status = 'publicado'
      AND p.publicado_em <= now()
      AND (_query IS NULL OR p.busca_tsv @@ _query)
      AND (_ano IS NULL OR extract(year FROM p.publicado_em)::int = _ano)
      AND (_mes IS NULL OR extract(month FROM p.publicado_em)::int = _mes)
      AND (
        NOT _has_temas
        OR EXISTS (SELECT 1 FROM post_temas pt WHERE pt.post_id = p.id AND pt.tema_id = ANY(_tema_ids))
      )
  ), counted AS (
    SELECT b.*, count(*) OVER () AS total FROM base b
  )
  SELECT
    c.id, c.titulo, c.slug, c.resumo, c.imagem_capa, c.credito_imagem, c.publicado_em,
    c.rank,
    CASE
      WHEN _query IS NULL THEN NULL
      ELSE ts_headline(
        'public.pt_unaccent',
        left(regexp_replace(coalesce(c.resumo,'') || ' ' || regexp_replace(coalesce(c.conteudo,''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'), 2000),
        _query,
        'StartSel=<mark>,StopSel=</mark>,MaxWords=28,MinWords=12,ShortWord=3,HighlightAll=false,MaxFragments=1'
      )
    END AS trecho,
    c.total
  FROM counted c
  ORDER BY
    CASE WHEN _ordem = 'rel' THEN c.rank END DESC NULLS LAST,
    CASE WHEN _ordem = 'asc' THEN c.publicado_em END ASC NULLS LAST,
    CASE WHEN _ordem = 'asc' THEN c.id END ASC,
    c.publicado_em DESC NULLS LAST,
    c.id DESC
  OFFSET _off LIMIT _lim;
END $$;

GRANT EXECUTE ON FUNCTION public.listar_arquivo(text, uuid[], int, int, text, int, int) TO anon, authenticated;
