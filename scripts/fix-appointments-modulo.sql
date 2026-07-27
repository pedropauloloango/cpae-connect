-- Escopo do agendamento (Acolhimento x Vivências).
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS modulo TEXT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_modulo_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_modulo_check
  CHECK (modulo IS NULL OR modulo IN ('acolhimento', 'vivencias'));

COMMENT ON COLUMN public.appointments.modulo IS
  'Módulo de origem do compromisso: acolhimento | vivencias. NULL = legado (tratado como acolhimento).';

CREATE INDEX IF NOT EXISTS idx_appointments_modulo
  ON public.appointments (modulo)
  WHERE modulo IS NOT NULL;
