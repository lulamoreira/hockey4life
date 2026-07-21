
-- 1. Extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Configuração de busca em português sem acento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.pt_unaccent (COPY = pg_catalog.portuguese);
    ALTER TEXT SEARCH CONFIGURATION public.pt_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, portuguese_stem;
  END IF;
END $$;

-- 3. Coluna busca_tsv
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS busca_tsv tsvector;

-- 4. Função de trigger
CREATE OR REPLACE FUNCTION public.posts_atualizar_busca_tsv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.busca_tsv :=
    setweight(to_tsvector('public.pt_unaccent', coalesce(NEW.titulo, '')), 'A') ||
    setweight(to_tsvector('public.pt_unaccent', coalesce(NEW.resumo, '')), 'B') ||
    setweight(to_tsvector('public.pt_unaccent', regexp_replace(coalesce(NEW.conteudo, ''), '<[^>]+>', ' ', 'g')), 'C');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_posts_busca_tsv ON public.posts;
CREATE TRIGGER trg_posts_busca_tsv
BEFORE INSERT OR UPDATE OF titulo, resumo, conteudo ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.posts_atualizar_busca_tsv();

-- 5. Preencher busca_tsv em linhas existentes
UPDATE public.posts SET titulo = titulo WHERE busca_tsv IS NULL;

-- 6. Índice GIN
CREATE INDEX IF NOT EXISTS posts_busca_tsv_idx ON public.posts USING GIN (busca_tsv);
CREATE INDEX IF NOT EXISTS posts_publicado_em_idx ON public.posts (publicado_em DESC, id DESC) WHERE status = 'publicado';
CREATE INDEX IF NOT EXISTS post_temas_tema_idx ON public.post_temas (tema_id);
CREATE INDEX IF NOT EXISTS post_temas_post_idx ON public.post_temas (post_id);

-- 7. Função de busca
CREATE OR REPLACE FUNCTION public.buscar_posts(
  _q text,
  _tema_ids uuid[] DEFAULT NULL,
  _ordem text DEFAULT 'rel',
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
      AND (
        _tema_ids IS NULL OR array_length(_tema_ids, 1) IS NULL
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

GRANT EXECUTE ON FUNCTION public.buscar_posts(text, uuid[], text, int, int) TO anon, authenticated;

-- 8. Contagem por ano/mês
CREATE OR REPLACE FUNCTION public.contagem_arquivo()
RETURNS TABLE(ano int, mes int, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT extract(year FROM publicado_em)::int AS ano,
         extract(month FROM publicado_em)::int AS mes,
         count(*)::bigint AS total
  FROM posts
  WHERE status = 'publicado' AND publicado_em <= now()
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.contagem_arquivo() TO anon, authenticated;

-- 9. Contagem por tema (só publicadas)
CREATE OR REPLACE FUNCTION public.contagem_temas()
RETURNS TABLE(id uuid, nome text, slug text, tipo text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.nome, t.slug, t.tipo::text,
    (SELECT count(*) FROM post_temas pt
      JOIN posts p ON p.id = pt.post_id
      WHERE pt.tema_id = t.id AND p.status = 'publicado' AND p.publicado_em <= now()
    )::bigint AS total
  FROM temas t
  ORDER BY t.nome;
$$;
GRANT EXECUTE ON FUNCTION public.contagem_temas() TO anon, authenticated;
