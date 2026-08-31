-- Campo sexo na inscrição do Curso de Saúde Mental.

ALTER TABLE public.saude_mental_inscritos
  ADD COLUMN IF NOT EXISTS sexo TEXT
  CHECK (sexo IS NULL OR sexo IN ('masculino', 'feminino', 'outros'));

COMMENT ON COLUMN public.saude_mental_inscritos.sexo IS
  'Sexo informado na inscrição: masculino, feminino ou outros.';

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
  v_msg TEXT;
  v_sexo TEXT;
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

  v_sexo := lower(NULLIF(trim(payload->>'sexo'), ''));
  IF v_sexo IS NULL OR v_sexo NOT IN ('masculino', 'feminino', 'outros') THEN
    RAISE EXCEPTION 'Selecione o sexo';
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
    sexo,
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
    v_sexo,
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
