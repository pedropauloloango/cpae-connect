
CREATE TYPE public.account_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pendente';

-- Usuários que já têm papel ficam aprovados
UPDATE public.profiles p
SET account_status = 'aprovado'
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'pendente')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
