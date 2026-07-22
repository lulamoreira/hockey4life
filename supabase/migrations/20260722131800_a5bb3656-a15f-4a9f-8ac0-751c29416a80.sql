
-- Autores
CREATE TABLE public.autores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  foto_url TEXT,
  links JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.autores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autores TO authenticated;
GRANT ALL ON public.autores TO service_role;

ALTER TABLE public.autores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autores leitura pública"
  ON public.autores FOR SELECT
  USING (true);

CREATE POLICY "autores staff escreve"
  ON public.autores FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_autores_updated
  BEFORE UPDATE ON public.autores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK em posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS autor_id UUID REFERENCES public.autores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_autor_id_idx ON public.posts(autor_id);

-- Autor padrão: Diogo Finelli
INSERT INTO public.autores (nome, slug, bio)
VALUES (
  'Diogo Finelli',
  'diogo-finelli',
  'Jornalista esportivo desde 2000, fã de hóquei no gelo desde 1995, quando conheceu o esporte nos jogos de computador. Torcedor do New York Rangers, fã de hard rock, e que encontrou no hóquei no gelo a identificação pelos ensinamentos e valores que o esporte propõe.'
)
ON CONFLICT (slug) DO NOTHING;

-- Backfill: todas as matérias vindas do WordPress recebem Diogo
UPDATE public.posts
SET autor_id = (SELECT id FROM public.autores WHERE slug = 'diogo-finelli')
WHERE wp_id IS NOT NULL AND autor_id IS NULL;
