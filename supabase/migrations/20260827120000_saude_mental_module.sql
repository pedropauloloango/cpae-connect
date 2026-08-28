-- Módulo Saúde Mental na Educação (inscritos no curso)

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS atende_saude_mental BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professionals.atende_saude_mental IS
  'Profissional atende o módulo Saúde Mental (curso / inscritos).';

CREATE SEQUENCE IF NOT EXISTS public.saude_mental_inscrito_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.saude_mental_inscritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT (
    'SM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.saude_mental_inscrito_number_seq')::text, 6, '0')
  ),
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  telefone_whatsapp TEXT,
  email TEXT,
  email_formulario TEXT,
  escola_texto TEXT,
  school_id UUID REFERENCES public.schools(id),
  school_nome_snapshot TEXT,
  funcao TEXT,
  nivel_escolaridade TEXT,
  ano_curso INTEGER NOT NULL DEFAULT 2026,
  inscrito_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'formulario'
    CHECK (origem IN ('formulario', 'importacao')),
  status TEXT NOT NULL DEFAULT 'inscrito'
    CHECK (status IN ('inscrito', 'cancelado')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_school
  ON public.saude_mental_inscritos(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_created
  ON public.saude_mental_inscritos(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_nome
  ON public.saude_mental_inscritos(nome_completo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_sem_escola
  ON public.saude_mental_inscritos(id)
  WHERE deleted_at IS NULL AND school_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_inscritos_ano
  ON public.saude_mental_inscritos(ano_curso DESC)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saude_mental_inscritos TO authenticated;
GRANT ALL ON public.saude_mental_inscritos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.saude_mental_inscrito_number_seq TO authenticated, service_role;

ALTER TABLE public.saude_mental_inscritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saude_mental_inscritos_select ON public.saude_mental_inscritos;
CREATE POLICY saude_mental_inscritos_select ON public.saude_mental_inscritos
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS saude_mental_inscritos_insert ON public.saude_mental_inscritos;
CREATE POLICY saude_mental_inscritos_insert ON public.saude_mental_inscritos
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS saude_mental_inscritos_update ON public.saude_mental_inscritos;
CREATE POLICY saude_mental_inscritos_update ON public.saude_mental_inscritos
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_saude_mental_inscritos_updated ON public.saude_mental_inscritos;
CREATE TRIGGER trg_saude_mental_inscritos_updated
  BEFORE UPDATE ON public.saude_mental_inscritos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
