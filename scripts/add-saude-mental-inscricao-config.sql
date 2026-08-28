-- Período de inscrições públicas do Curso de Saúde Mental na Educação
-- Execute no SQL Editor do Supabase se a migration ainda não foi aplicada.

CREATE TABLE IF NOT EXISTS public.saude_mental_inscricao_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  inscricoes_habilitadas BOOLEAN NOT NULL DEFAULT true,
  encerramento_em TIMESTAMPTZ,
  mensagem_encerrada TEXT NOT NULL DEFAULT
    'As inscrições para o Curso de Saúde Mental na Educação estão encerradas no momento.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.saude_mental_inscricao_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.saude_mental_inscricao_config TO authenticated;
GRANT ALL ON public.saude_mental_inscricao_config TO service_role;

ALTER TABLE public.saude_mental_inscricao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saude_mental_inscricao_config_select ON public.saude_mental_inscricao_config;
CREATE POLICY saude_mental_inscricao_config_select ON public.saude_mental_inscricao_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS saude_mental_inscricao_config_update ON public.saude_mental_inscricao_config;
CREATE POLICY saude_mental_inscricao_config_update ON public.saude_mental_inscricao_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_saude_mental_inscricao_config_updated ON public.saude_mental_inscricao_config;
CREATE TRIGGER trg_saude_mental_inscricao_config_updated
  BEFORE UPDATE ON public.saude_mental_inscricao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.saude_mental_inscricoes_abertas()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.inscricoes_habilitadas
        AND (c.encerramento_em IS NULL OR c.encerramento_em > now())
      FROM public.saude_mental_inscricao_config c
      WHERE c.id = 1
    ),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_saude_mental_inscricao_status()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'aberta', public.saude_mental_inscricoes_abertas(),
        'inscricoes_habilitadas', c.inscricoes_habilitadas,
        'encerramento_em', c.encerramento_em,
        'mensagem_encerrada', c.mensagem_encerrada
      )
      FROM public.saude_mental_inscricao_config c
      WHERE c.id = 1
    ),
    jsonb_build_object(
      'aberta', true,
      'inscricoes_habilitadas', true,
      'encerramento_em', NULL,
      'mensagem_encerrada',
      'As inscrições para o Curso de Saúde Mental na Educação estão encerradas no momento.'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.saude_mental_inscricoes_abertas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_saude_mental_inscricao_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.saude_mental_inscricoes_abertas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_saude_mental_inscricao_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_saude_mental_inscricao(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
  v_nome TEXT;
  v_ano INTEGER;
  v_msg TEXT;
BEGIN
  IF NOT public.saude_mental_inscricoes_abertas() THEN
    SELECT COALESCE(
      NULLIF(trim(c.mensagem_encerrada), ''),
      'As inscrições para o Curso de Saúde Mental na Educação estão encerradas no momento.'
    )
    INTO v_msg
    FROM public.saude_mental_inscricao_config c
    WHERE c.id = 1;

    RAISE EXCEPTION '%', COALESCE(
      v_msg,
      'As inscrições para o Curso de Saúde Mental na Educação estão encerradas no momento.'
    );
  END IF;

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
    nome_completo, cpf, data_nascimento, telefone_whatsapp, email, email_formulario,
    escola_texto, school_id, school_nome_snapshot, funcao, nivel_escolaridade,
    ano_curso, inscrito_em, origem, status
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
