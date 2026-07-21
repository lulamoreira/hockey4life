
DROP POLICY IF EXISTS "contatos_public_insert" ON public.contatos;
CREATE POLICY "contatos_public_insert" ON public.contatos
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(nome)) > 0
    AND length(trim(email)) > 3
    AND email LIKE '%@%.%'
    AND length(trim(mensagem)) > 0
    AND length(mensagem) < 5000
  );

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies for midia bucket
CREATE POLICY "midia_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'midia');

CREATE POLICY "midia_staff_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'midia' AND public.is_staff(auth.uid()));

CREATE POLICY "midia_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'midia' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'midia' AND public.is_staff(auth.uid()));

CREATE POLICY "midia_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'midia' AND public.is_staff(auth.uid()));
