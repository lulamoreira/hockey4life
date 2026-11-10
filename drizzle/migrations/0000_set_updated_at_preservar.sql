CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Correções técnicas (ex.: limpeza de imagens) podem preservar a data definindo h4l.preservar_data = '1' na sessão.
  IF coalesce(current_setting('h4l.preservar_data', true), '') = '1' THEN
    NEW.atualizado_em = OLD.atualizado_em;
  ELSE
    NEW.atualizado_em = now();
  END IF;
  RETURN NEW;
END; $$;