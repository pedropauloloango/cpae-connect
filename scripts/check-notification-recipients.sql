-- Confere quem deveria receber alerta de nova solicitação
-- Execute no SQL Editor do Supabase

SELECT
  p.id,
  p.full_name,
  p.email,
  p.account_status,
  p.receive_notification_emails,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.receive_notification_emails = true
   OR ur.role = 'admin'
ORDER BY p.receive_notification_emails DESC, p.email;

-- Se o admin aparecer com receive_notification_emails = false, ative:
-- UPDATE public.profiles
-- SET receive_notification_emails = true
-- WHERE lower(email) = lower('pedro.loango@hotmail.com');
