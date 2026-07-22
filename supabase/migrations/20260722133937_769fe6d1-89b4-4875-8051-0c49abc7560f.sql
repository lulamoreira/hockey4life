
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_autor_id_fkey;
UPDATE public.posts SET autor_id = NULL WHERE autor_id IS NOT NULL AND autor_id NOT IN (SELECT id FROM public.autores);
ALTER TABLE public.posts
  ADD CONSTRAINT posts_autor_id_fkey
  FOREIGN KEY (autor_id) REFERENCES public.autores(id) ON DELETE SET NULL;
