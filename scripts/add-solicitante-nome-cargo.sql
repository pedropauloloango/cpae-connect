-- Execute no SQL Editor do Supabase

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_cargo TEXT;
