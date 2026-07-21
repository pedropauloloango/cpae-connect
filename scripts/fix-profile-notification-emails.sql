-- Preferência de e-mail de notificação por usuário (execute no SQL Editor do Supabase)
-- Seguro para rodar mais de uma vez.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receive_notification_emails BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.receive_notification_emails IS
  'Se true, o usuário recebe e-mail ao criar nova solicitação de Acolhimento (e notificações similares).';

-- Opcional: ativar para admins já aprovados que tenham e-mail
-- UPDATE public.profiles p
-- SET receive_notification_emails = true
-- WHERE p.account_status = 'aprovado'
--   AND p.email IS NOT NULL
--   AND EXISTS (
--     SELECT 1 FROM public.user_roles ur
--     WHERE ur.user_id = p.id AND ur.role = 'admin'
--   );
