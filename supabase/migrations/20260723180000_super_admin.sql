-- Super Administrador: protegido contra rejeição / remoção de papel por outros admins.
-- has_role(..., 'admin') passa a incluir super_admin (mantém RLS existente).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (
          _role = 'admin'::public.app_role
          AND role = 'super_admin'::public.app_role
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- Autenticados precisam mutar papéis (fluxo Usuários); service_role mantém ALL.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;

DROP POLICY IF EXISTS "user_roles_admin_insert" ON public.user_roles;
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      role <> 'super_admin'::public.app_role
      OR public.is_super_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "user_roles_admin_update" ON public.user_roles;
CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      NOT public.is_super_admin(user_id)
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      role <> 'super_admin'::public.app_role
      OR public.is_super_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "user_roles_admin_delete" ON public.user_roles;
CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      NOT public.is_super_admin(user_id)
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(OLD.id) AND NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.account_status IS DISTINCT FROM OLD.account_status
       AND NEW.account_status = 'rejeitado' THEN
      RAISE EXCEPTION 'Não é permitido rejeitar o Super Administrador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_profile();

-- Bootstrap: PEDRO PAULO COIMBRA LOANGO (pedro.loango@hotmail.com)
DO $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower('pedro.loango@hotmail.com')
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE 'Usuário pedro.loango@hotmail.com não encontrado — role super_admin não aplicada.';
    RETURN;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, account_status)
  SELECT
    target_id,
    COALESCE(u.raw_user_meta_data->>'full_name', 'PEDRO PAULO COIMBRA LOANGO'),
    u.email,
    'aprovado'
  FROM auth.users u
  WHERE u.id = target_id
  ON CONFLICT (id) DO UPDATE
  SET account_status = 'aprovado',
      email = EXCLUDED.email;

  DELETE FROM public.user_roles
  WHERE user_id = target_id
    AND role IN ('admin'::public.app_role, 'profissional'::public.app_role);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
