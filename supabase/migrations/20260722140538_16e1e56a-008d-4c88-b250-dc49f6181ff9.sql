-- Separar quem escreveu a matéria (autor_id → autores) de quem criou o registro no sistema (criado_por → auth.users)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.posts.autor_id IS 'Autor da matéria (referência à tabela autores). Aparece publicamente no site.';
COMMENT ON COLUMN public.posts.criado_por IS 'Usuário do sistema que criou/importou o registro (uso interno).';

CREATE INDEX IF NOT EXISTS posts_criado_por_idx ON public.posts(criado_por);