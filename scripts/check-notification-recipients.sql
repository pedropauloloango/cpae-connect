-- Confere preferências de alerta por módulo
SELECT
  p.full_name,
  p.email,
  p.account_status,
  p.receive_acolhimento_emails AS alerta_acolhimento,
  p.receive_vivencias_emails AS alerta_vivencias,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.receive_acolhimento_emails = true
   OR p.receive_vivencias_emails = true
   OR ur.role = 'admin'
ORDER BY p.email;
