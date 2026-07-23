
-- Extensão da tabela profiles para cadastro de leitores
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metodo_login TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Handle new user: capta provedor e avatar, mantém idempotência
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, metodo_login, foto_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'nome',
      NEW.email
    ),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Perfil completo? (usado pelo gate de /completar-perfil)
CREATE OR REPLACE FUNCTION public.perfil_completo(_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _id
      AND nome IS NOT NULL AND length(trim(nome)) > 0
      AND telefone IS NOT NULL AND length(regexp_replace(telefone, '[^0-9]', '', 'g')) >= 10
      AND data_nascimento IS NOT NULL
      AND data_nascimento <= (current_date - interval '13 years')
      AND consentimento_em IS NOT NULL
  )
$$;

-- LGPD: apagar os dados pessoais do próprio usuário (matérias e autoria pública ficam)
CREATE OR REPLACE FUNCTION public.anonimizar_minha_conta()
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles  WHERE id = _uid;
END $$;

GRANT EXECUTE ON FUNCTION public.perfil_completo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonimizar_minha_conta() TO authenticated;
