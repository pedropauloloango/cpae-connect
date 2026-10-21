-- Impede que usuários comuns alterem o próprio status de conta ou preferências de e-mail.
-- A policy profiles_update_self libera UPDATE da linha inteira; este trigger restringe as colunas sensíveis.

CREATE OR REPLACE FUNCTION public.profiles_guard_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  actor_is_admin BOOLEAN;
BEGIN
  -- Sem usuário autenticado: SQL Editor, service_role ou trigger de criação em auth.users.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  actor_is_admin := public.has_role(actor, 'admin') OR public.is_super_admin(actor);
  IF actor_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.account_status := 'pendente';
    NEW.receive_acolhimento_emails := false;
    NEW.receive_vivencias_emails := false;
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o status da conta.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.receive_acolhimento_emails IS DISTINCT FROM OLD.receive_acolhimento_emails
     OR NEW.receive_vivencias_emails IS DISTINCT FROM OLD.receive_vivencias_emails THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar as preferências de e-mail por módulo.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_guard_sensitive_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_guard_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_profiles_guard_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_sensitive_columns();
