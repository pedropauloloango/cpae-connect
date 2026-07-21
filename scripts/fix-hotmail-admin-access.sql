-- Libera pedro.loango@hotmail.com como admin aprovado
-- Execute no SQL Editor do Supabase (uma vez).

DO $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower('pedro.loango@hotmail.com')
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Usuário pedro.loango@hotmail.com não encontrado em auth.users. Confirme o e-mail do login.';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, account_status, receive_notification_emails)
  SELECT
    target_id,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Pedro Loango'),
    u.email,
    'aprovado',
    true
  FROM auth.users u
  WHERE u.id = target_id
  ON CONFLICT (id) DO UPDATE
  SET
    account_status = 'aprovado',
    email = EXCLUDED.email,
    receive_notification_emails = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'OK: % aprovado como admin', target_id;
END $$;

-- Conferência
SELECT
  u.email,
  p.account_status,
  p.receive_notification_emails,
  ur.role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) IN (
  lower('pedro.loango@hotmail.com'),
  lower('pedroloango@gmail.com')
);
