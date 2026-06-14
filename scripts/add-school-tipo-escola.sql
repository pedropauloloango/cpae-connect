-- Execute no SQL Editor do Supabase

DO $$ BEGIN
  CREATE TYPE public.school_tipo AS ENUM ('escola', 'emei');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tipo_escola public.school_tipo NOT NULL DEFAULT 'escola';
