-- Nome do representante da escola no agendamento de visita
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS representante_nome TEXT;
