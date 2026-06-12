
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- has_role must remain callable by authenticated users since it's used in RLS policies

DROP POLICY IF EXISTS "logs_authenticated_insert" ON public.activity_logs;
CREATE POLICY "logs_authenticated_insert" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
