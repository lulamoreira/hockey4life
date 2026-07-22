
GRANT SELECT ON public.autores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autores TO authenticated;
GRANT ALL ON public.autores TO service_role;

DROP POLICY IF EXISTS "autores leitura publica" ON public.autores;
CREATE POLICY "autores leitura publica" ON public.autores FOR SELECT USING (true);

DROP POLICY IF EXISTS "autores staff gerencia" ON public.autores;
CREATE POLICY "autores staff gerencia" ON public.autores FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS autores_set_updated ON public.autores;
CREATE TRIGGER autores_set_updated
  BEFORE UPDATE ON public.autores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS posts_autor_id_idx ON public.posts(autor_id);
