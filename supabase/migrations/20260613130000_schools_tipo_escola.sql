CREATE TYPE public.school_tipo AS ENUM ('escola', 'emei');

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tipo_escola public.school_tipo NOT NULL DEFAULT 'escola';
