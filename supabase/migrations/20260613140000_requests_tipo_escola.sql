ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS tipo_escola public.school_tipo;
