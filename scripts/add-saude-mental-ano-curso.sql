-- Rodar no SQL Editor do Supabase se a migration ainda não foi aplicada.
-- Adiciona ano_curso e popula registros existentes com 2026.

ALTER TABLE public.saude_mental_inscritos
  ADD COLUMN IF NOT EXISTS ano_curso INTEGER;

UPDATE public.saude_mental_inscritos
SET ano_curso = 2026
WHERE ano_curso IS NULL;

ALTER TABLE public.saude_mental_inscritos
  ALTER COLUMN ano_curso SET DEFAULT 2026,
  ALTER COLUMN ano_curso SET NOT NULL;

COMMENT ON COLUMN public.saude_mental_inscritos.ano_curso IS
  'Ano letivo / edição do Curso de Saúde Mental na Educação.';

CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_ano
  ON public.saude_mental_inscritos(ano_curso DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.submit_saude_mental_inscricao(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
  v_nome TEXT;
  v_ano INTEGER;
BEGIN
  v_nome := NULLIF(trim(payload->>'nome_completo'), '');
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome completo';
  END IF;

  v_school_id := NULLIF(trim(payload->>'school_id'), '')::UUID;

  IF v_school_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = v_school_id AND s.deleted_at IS NULL AND s.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Escola ou EMEI inválida';
  END IF;

  v_ano := COALESCE(
    NULLIF(trim(payload->>'ano_curso'), '')::INTEGER,
    EXTRACT(YEAR FROM now())::INTEGER
  );

  INSERT INTO public.saude_mental_inscritos (
    nome_completo,
    cpf,
    data_nascimento,
    telefone_whatsapp,
    email,
    email_formulario,
    escola_texto,
    school_id,
    school_nome_snapshot,
    funcao,
    nivel_escolaridade,
    ano_curso,
    inscrito_em,
    origem,
    status
  ) VALUES (
    upper(v_nome),
    NULLIF(trim(payload->>'cpf'), ''),
    NULLIF(trim(payload->>'data_nascimento'), '')::DATE,
    NULLIF(trim(payload->>'telefone_whatsapp'), ''),
    NULLIF(lower(trim(payload->>'email')), ''),
    NULLIF(lower(trim(payload->>'email_formulario')), ''),
    NULLIF(trim(payload->>'escola_texto'), ''),
    v_school_id,
    NULLIF(trim(payload->>'school_nome'), ''),
    NULLIF(trim(payload->>'funcao'), ''),
    NULLIF(trim(payload->>'nivel_escolaridade'), ''),
    v_ano,
    COALESCE(NULLIF(trim(payload->>'inscrito_em'), '')::TIMESTAMPTZ, now()),
    COALESCE(NULLIF(trim(payload->>'origem'), ''), 'formulario'),
    'inscrito'
  )
  RETURNING saude_mental_inscritos.id, saude_mental_inscritos.numero INTO v_id, v_numero;

  RETURN QUERY SELECT v_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_saude_mental_inscricao(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_saude_mental_inscricao(JSONB) TO anon, authenticated;
