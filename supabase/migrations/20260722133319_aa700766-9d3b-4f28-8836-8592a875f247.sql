
ALTER TABLE public.autores
  ADD COLUMN IF NOT EXISTS bio_curta text,
  ADD COLUMN IF NOT EXISTS bio_media text,
  ADD COLUMN IF NOT EXISTS bio_longa text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS outros_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linha_do_tempo jsonb NOT NULL DEFAULT '[]'::jsonb;
