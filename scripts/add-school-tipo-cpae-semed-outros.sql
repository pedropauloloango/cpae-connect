-- Novos tipos de unidade no cadastro de escolas.
-- Execute no SQL Editor do Supabase se a migration ainda não tiver sido aplicada.

ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'cpae';
ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'semed';
ALTER TYPE public.school_tipo ADD VALUE IF NOT EXISTS 'outros';
