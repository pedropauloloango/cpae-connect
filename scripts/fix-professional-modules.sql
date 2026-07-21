-- Execute este script no SQL Editor do Supabase.
-- É seguro executá-lo novamente.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS atende_acolhimento BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS atende_vivencias BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.professionals.atende_acolhimento IS
  'Indica se o profissional pode atender demandas do módulo Acolhimento.';

COMMENT ON COLUMN public.professionals.atende_vivencias IS
  'Indica se o profissional pode atender demandas do módulo Vivências.';

ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_at_least_one_module;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_at_least_one_module
  CHECK (atende_acolhimento OR atende_vivencias);

CREATE INDEX IF NOT EXISTS idx_professionals_acolhimento
  ON public.professionals(nome)
  WHERE atende_acolhimento AND status = 'ativo' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_professionals_vivencias
  ON public.professionals(nome)
  WHERE atende_vivencias AND status = 'ativo' AND deleted_at IS NULL;
