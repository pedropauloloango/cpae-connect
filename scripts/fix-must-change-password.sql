-- Flag para forçar troca de senha após "Esqueci a senha".
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Quando TRUE, o usuário deve definir uma nova senha no próximo acesso (ex.: após reset).';
