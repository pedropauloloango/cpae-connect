-- =============================================================================
-- Correção do módulo Usuários (execute no SQL Editor do Supabase)
-- Seguro para rodar mais de uma vez.
-- =============================================================================

-- 1) Enum de status da conta
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Coluna account_status em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pendente';

-- 3) Vínculo login ↔ profissional (já existe na migration principal; garante se faltar)
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_key ON public.professionals(user_id)
  WHERE user_id IS NOT NULL;

-- 4) Perfis para usuários do Auth que ainda não têm linha em profiles
INSERT INTO public.profiles (id, full_name, email, account_status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  u.email,
  'pendente'::public.account_status
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 5) Quem já tem papel vira aprovado
UPDATE public.profiles p
SET account_status = 'aprovado'
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id);

-- 6) Trigger de novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'pendente')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name = '' OR public.profiles.full_name IS NULL
      THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END;
  RETURN NEW;
END; $$;

-- 7) Políticas RLS para admin gerenciar usuários
DO $$ BEGIN
  CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_admin_select" ON public.user_roles FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Verificação (deve listar account_status e user_id)
-- =============================================================================
SELECT 'profiles' AS tabela, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('account_status', 'email', 'full_name')
UNION ALL
SELECT 'professionals', column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'professionals'
  AND column_name = 'user_id';

SELECT p.id, p.full_name, p.email, p.account_status, ur.role AS permissao, pr.nome AS profissional_vinculado
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.professionals pr ON pr.user_id = p.id
ORDER BY p.created_at DESC;
