-- Novos tipos de unidade: CPAE, SEMED e Outros.

ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'cpae';
ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'semed';
ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'outros';
