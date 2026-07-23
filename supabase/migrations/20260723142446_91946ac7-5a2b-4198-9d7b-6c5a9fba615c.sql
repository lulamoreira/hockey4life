
-- ============================================================
-- 1) TABELA papeis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.papeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  sistema boolean NOT NULL DEFAULT false,
  permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.papeis TO authenticated;
GRANT ALL ON public.papeis TO service_role;

ALTER TABLE public.papeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "papeis_read_auth" ON public.papeis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "papeis_admin_write" ON public.papeis
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_papeis_updated ON public.papeis;
CREATE TRIGGER trg_papeis_updated
  BEFORE UPDATE ON public.papeis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.papeis (nome, slug, descricao, sistema, permissoes) VALUES
  ('Leitor', 'leitor',
   'Só lê o site e cuida da própria conta.',
   true,
   '{"escrever":false,"enviar_para_revisao":false,"publicar_propria":false,"editar_qualquer":false,"aprovar":false,"publicar_qualquer":false,"gerenciar_temas":false,"gerenciar_usuarios":false,"gerenciar_configuracoes":false,"gerenciar_midia":false,"ver_painel":false}'::jsonb),
  ('Escritor', 'escritor',
   'Cria matérias em rascunho e envia para revisão.',
   true,
   '{"escrever":true,"enviar_para_revisao":true,"publicar_propria":false,"editar_qualquer":false,"aprovar":false,"publicar_qualquer":false,"gerenciar_temas":false,"gerenciar_usuarios":false,"gerenciar_configuracoes":false,"gerenciar_midia":false,"ver_painel":true}'::jsonb),
  ('Editor', 'editor',
   'Aprova, edita e publica matérias de qualquer autor.',
   true,
   '{"escrever":true,"enviar_para_revisao":true,"publicar_propria":true,"editar_qualquer":true,"aprovar":true,"publicar_qualquer":true,"gerenciar_temas":true,"gerenciar_usuarios":false,"gerenciar_configuracoes":false,"gerenciar_midia":true,"ver_painel":true}'::jsonb),
  ('Administrador', 'administrador',
   'Controle total do site.',
   true,
   '{"escrever":true,"enviar_para_revisao":true,"publicar_propria":true,"editar_qualquer":true,"aprovar":true,"publicar_qualquer":true,"gerenciar_temas":true,"gerenciar_usuarios":true,"gerenciar_configuracoes":true,"gerenciar_midia":true,"ver_painel":true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2) user_roles: papel_id
-- ============================================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS papel_id uuid REFERENCES public.papeis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_papel ON public.user_roles(papel_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_uniq ON public.user_roles(user_id);
ALTER TABLE public.user_roles ALTER COLUMN role DROP NOT NULL;

UPDATE public.user_roles
   SET papel_id = (SELECT id FROM public.papeis WHERE slug='administrador')
 WHERE role = 'admin' AND papel_id IS NULL;

UPDATE public.user_roles
   SET papel_id = (SELECT id FROM public.papeis WHERE slug='editor')
 WHERE role = 'editor' AND papel_id IS NULL;

-- ============================================================
-- 3) autores.user_id
-- ============================================================
ALTER TABLE public.autores
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS autores_user_id_uniq ON public.autores(user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- 4) Enum novos valores + colunas de revisão
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='post_status' AND e.enumlabel='em_revisao') THEN
    ALTER TYPE public.post_status ADD VALUE 'em_revisao';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='post_status' AND e.enumlabel='rejeitado') THEN
    ALTER TYPE public.post_status ADD VALUE 'rejeitado';
  END IF;
END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS revisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS enviado_revisao_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_enviado_revisao ON public.posts(enviado_revisao_em DESC);

-- ============================================================
-- 5) Funções
-- ============================================================
CREATE OR REPLACE FUNCTION public.tem_permissao(_user_id uuid, _permissao text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.papeis p ON p.id = ur.papel_id
     WHERE ur.user_id = _user_id
       AND COALESCE((p.permissoes ->> _permissao)::boolean, false) = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = _user_id AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.papeis p ON p.id = ur.papel_id
     WHERE ur.user_id = _user_id
       AND (
         ur.role = _role
         OR (_role = 'admin'::app_role AND p.slug = 'administrador')
         OR (_role = 'editor'::app_role AND p.slug IN ('editor','administrador'))
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.papeis p ON p.id = ur.papel_id
     WHERE ur.user_id = _user_id
       AND (
         ur.role IN ('admin','editor')
         OR p.slug IN ('administrador','editor','escritor')
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tem_permissao(uuid, text) TO authenticated, anon;

-- ============================================================
-- 6) Sincroniza role a partir do papel_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_user_role_from_papel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _slug text;
BEGIN
  IF NEW.papel_id IS NOT NULL THEN
    SELECT slug INTO _slug FROM public.papeis WHERE id = NEW.papel_id;
    IF _slug = 'administrador' THEN
      NEW.role := 'admin'::app_role;
    ELSIF _slug = 'editor' THEN
      NEW.role := 'editor'::app_role;
    ELSE
      NEW.role := NULL;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_user_role_from_papel ON public.user_roles;
CREATE TRIGGER trg_sync_user_role_from_papel
  BEFORE INSERT OR UPDATE OF papel_id ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_from_papel();

-- ============================================================
-- 7) RLS de posts
-- ============================================================
DROP POLICY IF EXISTS "posts_auth_read" ON public.posts;
DROP POLICY IF EXISTS "posts_public_read" ON public.posts;
DROP POLICY IF EXISTS "posts_staff_write" ON public.posts;

CREATE POLICY "posts_public_read" ON public.posts
  FOR SELECT TO anon
  USING (status = 'publicado'::post_status
         AND publicado_em IS NOT NULL
         AND publicado_em <= now());

CREATE POLICY "posts_auth_read" ON public.posts
  FOR SELECT TO authenticated
  USING (
    (status = 'publicado'::post_status
      AND publicado_em IS NOT NULL
      AND publicado_em <= now())
    OR criado_por = auth.uid()
    OR public.tem_permissao(auth.uid(), 'editar_qualquer')
    OR public.tem_permissao(auth.uid(), 'aprovar')
  );

CREATE POLICY "posts_insert_autor" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao(auth.uid(), 'escrever')
    AND criado_por = auth.uid()
  );

CREATE POLICY "posts_update_flow" ON public.posts
  FOR UPDATE TO authenticated
  USING (
    (criado_por = auth.uid() AND public.tem_permissao(auth.uid(), 'escrever'))
    OR public.tem_permissao(auth.uid(), 'editar_qualquer')
    OR public.tem_permissao(auth.uid(), 'aprovar')
  )
  WITH CHECK (
    (
      (criado_por = auth.uid() AND public.tem_permissao(auth.uid(), 'escrever'))
      OR public.tem_permissao(auth.uid(), 'editar_qualquer')
      OR public.tem_permissao(auth.uid(), 'aprovar')
    )
    AND (
      status <> 'publicado'::post_status
      OR public.tem_permissao(auth.uid(), 'publicar_qualquer')
      OR (criado_por = auth.uid() AND public.tem_permissao(auth.uid(), 'publicar_propria'))
    )
  );

CREATE POLICY "posts_delete_flow" ON public.posts
  FOR DELETE TO authenticated
  USING (
    public.tem_permissao(auth.uid(), 'editar_qualquer')
    OR (criado_por = auth.uid()
        AND status::text IN ('rascunho','rejeitado'))
  );

-- ============================================================
-- 8) papeis + user_roles: escrita por gerenciar_usuarios
-- ============================================================
DROP POLICY IF EXISTS "papeis_admin_write" ON public.papeis;
CREATE POLICY "papeis_admin_write" ON public.papeis
  FOR ALL TO authenticated
  USING (public.tem_permissao(auth.uid(), 'gerenciar_usuarios'))
  WITH CHECK (public.tem_permissao(auth.uid(), 'gerenciar_usuarios'));

DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.tem_permissao(auth.uid(), 'gerenciar_usuarios'))
  WITH CHECK (public.tem_permissao(auth.uid(), 'gerenciar_usuarios'));
