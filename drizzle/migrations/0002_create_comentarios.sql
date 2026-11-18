CREATE TABLE public.comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid,
  nome text NOT NULL,
  texto text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  moderado_em timestamptz,
  moderado_por uuid
);
CREATE INDEX comentarios_post_status_idx ON public.comentarios (post_id, status, criado_em);
CREATE INDEX comentarios_status_idx ON public.comentarios (status, criado_em DESC);

GRANT SELECT, INSERT ON public.comentarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios TO authenticated;
GRANT ALL ON public.comentarios TO service_role;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY comentarios_public_read ON public.comentarios FOR SELECT TO anon, authenticated
  USING (status = 'aprovado');
CREATE POLICY comentarios_mod_read ON public.comentarios FOR SELECT TO authenticated
  USING (public.tem_permissao(auth.uid(), 'aprovar'));
CREATE POLICY comentarios_insert ON public.comentarios FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pendente' AND moderado_em IS NULL AND moderado_por IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND length(trim(nome)) BETWEEN 2 AND 60
    AND length(trim(texto)) BETWEEN 2 AND 2000
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status = 'publicado' AND p.publicado_em <= now())
  );
CREATE POLICY comentarios_mod_update ON public.comentarios FOR UPDATE TO authenticated
  USING (public.tem_permissao(auth.uid(), 'aprovar'))
  WITH CHECK (public.tem_permissao(auth.uid(), 'aprovar'));
CREATE POLICY comentarios_mod_delete ON public.comentarios FOR DELETE TO authenticated
  USING (public.tem_permissao(auth.uid(), 'aprovar'));