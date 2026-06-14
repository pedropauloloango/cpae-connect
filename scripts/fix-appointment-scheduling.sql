-- Corrige agendamento de visitas (coluna numero e demais campos em appointments)
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard → SQL → New query
-- Depois de executar, aguarde ~30s ou recarregue o schema (Settings → API → Reload schema)

-- Novos tipos de visita
ALTER TYPE public.meeting_type ADD VALUE IF NOT EXISTS 'vivencia';
ALTER TYPE public.meeting_type ADD VALUE IF NOT EXISTS 'palestra';

-- Cargo do representante na escola
DO $$ BEGIN
  CREATE TYPE public.school_representative_role AS ENUM ('diretor', 'adjunto', 'secretario');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Colunas em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS numero public.meeting_number,
  ADD COLUMN IF NOT EXISTS representante_cargo public.school_representative_role,
  ADD COLUMN IF NOT EXISTS representante_nome TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_request_numero
  ON public.appointments (request_id, numero)
  WHERE request_id IS NOT NULL AND numero IS NOT NULL;

-- Vínculo encontro ↔ agendamento
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_appointment_id
  ON public.meetings (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Força atualização do cache de schema do PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';
