-- Execute no SQL Editor do Supabase

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS aluno_sexo TEXT;
