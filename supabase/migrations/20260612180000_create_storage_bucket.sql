-- Bucket de anexos do módulo Acolhimento (referenciado nas policies de storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'acolhimento-anexos',
  'acolhimento-anexos',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;
