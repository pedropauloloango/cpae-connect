
-- Public can upload to public/ folder (used by public acolhimento form)
CREATE POLICY "anexos_public_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'acolhimento-anexos' AND (storage.foldername(name))[1] = 'public');

-- Authenticated users can upload to authenticated/ folder
CREATE POLICY "anexos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'acolhimento-anexos' AND (storage.foldername(name))[1] = 'authenticated');

-- Authenticated users can read all attachments (RLS on attachments table provides finer control)
CREATE POLICY "anexos_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'acolhimento-anexos');

-- Admins can delete
CREATE POLICY "anexos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'acolhimento-anexos' AND public.has_role(auth.uid(), 'admin'));
