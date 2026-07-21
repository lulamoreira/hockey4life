
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.app_role AS ENUM ('admin', 'editor');
CREATE TYPE public.tema_tipo AS ENUM ('time', 'assunto');
CREATE TYPE public.post_status AS ENUM ('rascunho', 'publicado');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated, anon;

-- temas
CREATE TABLE public.temas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tipo public.tema_tipo NOT NULL,
  destaque_menu BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  wp_tag_id INTEGER UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_temas_tipo ON public.temas(tipo);
CREATE INDEX idx_temas_destaque ON public.temas(destaque_menu, ordem);
GRANT SELECT ON public.temas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.temas TO authenticated;
GRANT ALL ON public.temas TO service_role;
ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;

-- posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wp_id INTEGER UNIQUE,
  titulo TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  resumo TEXT,
  conteudo TEXT,
  imagem_capa TEXT,
  credito_imagem TEXT,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.post_status NOT NULL DEFAULT 'rascunho',
  destaque BOOLEAN NOT NULL DEFAULT false,
  nao_perca BOOLEAN NOT NULL DEFAULT false,
  publicado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_status_pub ON public.posts(status, publicado_em DESC);
CREATE INDEX idx_posts_destaque ON public.posts(destaque, publicado_em DESC) WHERE status = 'publicado';
CREATE INDEX idx_posts_nao_perca ON public.posts(nao_perca, publicado_em DESC) WHERE status = 'publicado';
CREATE INDEX idx_posts_slug ON public.posts(slug);
CREATE INDEX idx_posts_titulo_trgm ON public.posts USING gin (titulo gin_trgm_ops);
CREATE INDEX idx_posts_resumo_trgm ON public.posts USING gin (resumo gin_trgm_ops);

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- post_temas
CREATE TABLE public.post_temas (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tema_id UUID NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tema_id)
);
CREATE INDEX idx_post_temas_tema ON public.post_temas(tema_id);
GRANT SELECT ON public.post_temas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.post_temas TO authenticated;
GRANT ALL ON public.post_temas TO service_role;
ALTER TABLE public.post_temas ENABLE ROW LEVEL SECURITY;

-- configuracoes
CREATE TABLE public.configuracoes (
  chave TEXT NOT NULL PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.configuracoes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- contatos
CREATE TABLE public.contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT,
  mensagem TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  lido BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_contatos_criado ON public.contatos(criado_em DESC);
GRANT INSERT ON public.contatos TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contatos TO authenticated;
GRANT ALL ON public.contatos TO service_role;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "temas_public_read" ON public.temas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "temas_staff_write" ON public.temas FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "posts_public_read" ON public.posts FOR SELECT TO anon
  USING (status = 'publicado' AND publicado_em IS NOT NULL AND publicado_em <= now());
CREATE POLICY "posts_auth_read" ON public.posts FOR SELECT TO authenticated
  USING ((status = 'publicado' AND publicado_em IS NOT NULL AND publicado_em <= now()) OR public.is_staff(auth.uid()));
CREATE POLICY "posts_staff_write" ON public.posts FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "post_temas_public_read" ON public.post_temas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "post_temas_staff_write" ON public.post_temas FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "configuracoes_public_read" ON public.configuracoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "configuracoes_staff_write" ON public.configuracoes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "contatos_public_insert" ON public.contatos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "contatos_admin_read" ON public.contatos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "contatos_admin_update" ON public.contatos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "contatos_admin_delete" ON public.contatos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('hockey_fights_cancer', '{"video_url":"https://www.youtube.com/embed/dQw4w9WgXcQ","titulo":"Hockey Fights Cancer","texto":"O hóquei se une na luta contra o câncer. Conheça a história."}'::jsonb),
  ('rodape', '{"texto":"Hockey4Life — histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo.","creditos":"Agência Mecânica • Lula Moreira"}'::jsonb),
  ('contato', '{"email":"contato@hockey4life.com.br"}'::jsonb),
  ('redes_sociais', '{"instagram":"","facebook":"","x":"","youtube":""}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.temas (nome, slug, tipo, destaque_menu, ordem) VALUES
  ('NHL', 'nhl', 'assunto', true, 1),
  ('Superação', 'superacao', 'assunto', true, 2),
  ('Gentileza', 'gentileza', 'assunto', true, 3)
ON CONFLICT (slug) DO NOTHING;
