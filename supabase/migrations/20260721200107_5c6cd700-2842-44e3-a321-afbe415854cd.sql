
-- Função pública que informa se já existe pelo menos um admin
CREATE OR REPLACE FUNCTION public.existe_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.existe_staff() TO anon, authenticated;

-- Função que promove o usuário autenticado atual a admin,
-- APENAS se ainda não existir nenhum admin no sistema.
-- A checagem é feita no servidor, dentro da função SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.criar_primeiro_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- trava a tabela para evitar corrida entre dois cadastros simultâneos
  LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_primeiro_admin() TO authenticated;

-- ============ Políticas do bucket "midia" ============
-- Leitura pública, escrita/exclusão apenas para admin/editor.
DROP POLICY IF EXISTS "midia leitura publica" ON storage.objects;
DROP POLICY IF EXISTS "midia insert staff" ON storage.objects;
DROP POLICY IF EXISTS "midia update staff" ON storage.objects;
DROP POLICY IF EXISTS "midia delete staff" ON storage.objects;

CREATE POLICY "midia leitura publica"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'midia');

CREATE POLICY "midia insert staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'midia' AND public.is_staff(auth.uid()));

CREATE POLICY "midia update staff"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'midia' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'midia' AND public.is_staff(auth.uid()));

CREATE POLICY "midia delete staff"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'midia' AND public.is_staff(auth.uid()));
