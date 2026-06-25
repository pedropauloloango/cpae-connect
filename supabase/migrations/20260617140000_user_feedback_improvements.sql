-- 4º e 5º encontros
ALTER TYPE public.meeting_number ADD VALUE IF NOT EXISTS 'quarto';
ALTER TYPE public.meeting_number ADD VALUE IF NOT EXISTS 'quinto';

-- Opções de encaminhamento nos encontros
ALTER TYPE public.meeting_referral_option ADD VALUE IF NOT EXISTS 'dae_sugenor';
ALTER TYPE public.meeting_referral_option ADD VALUE IF NOT EXISTS 'conselho_tutelar';

-- Cargo do representante na agenda de visita
ALTER TYPE public.school_representative_role ADD VALUE IF NOT EXISTS 'coordenador_pedagogico';

-- Status do relatório circunstanciado
ALTER TYPE public.closure_result ADD VALUE IF NOT EXISTS 'concluido_com_encaminhamento';
ALTER TYPE public.closure_result ADD VALUE IF NOT EXISTS 'em_andamento';
