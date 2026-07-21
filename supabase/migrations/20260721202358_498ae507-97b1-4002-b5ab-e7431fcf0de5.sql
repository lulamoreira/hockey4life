
CREATE TABLE IF NOT EXISTS public.importacao_estado (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultima_pagina INT NOT NULL DEFAULT 0,
  total_paginas INT NOT NULL DEFAULT 0,
  total_importados INT NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.importacao_estado (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacao_estado TO authenticated;
GRANT ALL ON public.importacao_estado TO service_role;
ALTER TABLE public.importacao_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin lê estado" ON public.importacao_estado FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin escreve estado" ON public.importacao_estado FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TYPE public.importacao_status AS ENUM ('ok','erro');

CREATE TABLE IF NOT EXISTS public.importacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id INT NOT NULL UNIQUE,
  slug TEXT,
  status public.importacao_status NOT NULL,
  erro TEXT,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_importacao_itens_status ON public.importacao_itens(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacao_itens TO authenticated;
GRANT ALL ON public.importacao_itens TO service_role;
ALTER TABLE public.importacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin lê itens" ON public.importacao_itens FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin escreve itens" ON public.importacao_itens FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
