-- Separa alertas de e-mail: Acolhimento x Vivências
-- Execute no SQL Editor do Supabase (seguro rodar mais de uma vez).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receive_acolhimento_emails BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receive_vivencias_emails BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.receive_acolhimento_emails IS
  'Se true, recebe e-mail ao criar nova solicitação de Acolhimento.';

COMMENT ON COLUMN public.profiles.receive_vivencias_emails IS
  'Se true, recebe e-mail ao criar nova solicitação de Vivências.';

-- Migra preferência antiga (se existir) para os dois módulos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'receive_notification_emails'
  ) THEN
    UPDATE public.profiles
    SET
      receive_acolhimento_emails = COALESCE(receive_acolhimento_emails, false) OR receive_notification_emails,
      receive_vivencias_emails = COALESCE(receive_vivencias_emails, false) OR receive_notification_emails
    WHERE receive_notification_emails = true;
  END IF;
END $$;
