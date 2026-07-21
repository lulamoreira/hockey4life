
-- Tabela de log de restaurações
CREATE TABLE public.restauracao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email text,
  modo text NOT NULL CHECK (modo IN ('mesclar','substituir')),
  criadas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  apagadas integer NOT NULL DEFAULT 0,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.restauracao_log TO authenticated;
GRANT ALL ON public.restauracao_log TO service_role;

ALTER TABLE public.restauracao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restauracao_log_admin_read" ON public.restauracao_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "restauracao_log_admin_insert" ON public.restauracao_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Políticas do bucket privado 'backups': só admin
CREATE POLICY "backups_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "backups_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "backups_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "backups_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
