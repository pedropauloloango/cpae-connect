DO $$ BEGIN
  CREATE TYPE public.meeting_referral_option AS ENUM (
    'ubs_ubsf',
    'clinica_escola_psicologia',
    'caps_ij',
    'rede_privada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS opcoes_encaminhamento public.meeting_referral_option[] NOT NULL DEFAULT '{}';
