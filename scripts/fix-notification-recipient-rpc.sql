-- Destinatários de alerta por módulo (SECURITY DEFINER — bypass RLS)
-- Somente admin/super_admin com a flag do módulo = true.
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.get_notification_recipient_emails(p_module text)
RETURNS TABLE (email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT lower(trim(p.email))::text AS email
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.email IS NOT NULL
    AND length(trim(p.email)) > 3
    AND coalesce(p.account_status::text, 'aprovado') <> 'rejeitado'
    AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
    AND (
      (p_module = 'acolhimento' AND p.receive_acolhimento_emails IS TRUE)
      OR (p_module = 'vivencias' AND p.receive_vivencias_emails IS TRUE)
    );
$$;

REVOKE ALL ON FUNCTION public.get_notification_recipient_emails(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_recipient_emails(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_recipient_emails(text) TO postgres;

NOTIFY pgrst, 'reload schema';

-- Teste:
-- SELECT * FROM public.get_notification_recipient_emails('acolhimento');
-- SELECT * FROM public.get_notification_recipient_emails('vivencias');
--
-- Conferir flags:
-- SELECT full_name, email, receive_acolhimento_emails, receive_vivencias_emails
-- FROM public.profiles
-- ORDER BY full_name;
