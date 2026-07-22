-- Destinatários de alerta por módulo (SECURITY DEFINER — bypass RLS)
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
  WHERE p.email IS NOT NULL
    AND length(trim(p.email)) > 3
    AND coalesce(p.account_status::text, 'aprovado') <> 'rejeitado'
    AND (
      (
        p_module = 'acolhimento'
        AND (
          coalesce(p.receive_acolhimento_emails, false) = true
          OR coalesce(p.receive_notification_emails, false) = true
        )
      )
      OR (
        p_module = 'vivencias'
        AND (
          coalesce(p.receive_vivencias_emails, false) = true
          OR coalesce(p.receive_notification_emails, false) = true
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_notification_recipient_emails(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_recipient_emails(text) TO service_role;

-- Teste:
-- SELECT * FROM public.get_notification_recipient_emails('acolhimento');
-- SELECT * FROM public.get_notification_recipient_emails('vivencias');
