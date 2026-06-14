-- Execute no SQL Editor do Supabase (campos do formulário oficial de acolhimento)

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT,
  ADD COLUMN IF NOT EXISTS regiao_escola TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_nome_cargo TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_telefone TEXT,
  ADD COLUMN IF NOT EXISTS modalidade_acolhimento TEXT,
  ADD COLUMN IF NOT EXISTS educacao_especial BOOLEAN,
  ADD COLUMN IF NOT EXISTS aluno_turma_ano TEXT,
  ADD COLUMN IF NOT EXISTS periodo TEXT,
  ADD COLUMN IF NOT EXISTS comunicou_abuso TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS situacao_observada TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acolhido_anteriormente BOOLEAN,
  ADD COLUMN IF NOT EXISTS autorizacao_ata TEXT;

ALTER TABLE public.requests ALTER COLUMN descricao DROP NOT NULL;
ALTER TABLE public.requests ALTER COLUMN descricao SET DEFAULT '';
ALTER TABLE public.requests ALTER COLUMN tipo_queixa DROP NOT NULL;
