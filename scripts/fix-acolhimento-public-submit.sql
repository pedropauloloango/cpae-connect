-- Execute no SQL Editor do Supabase
-- Formulário público /acolhimento: função RPC (contorna RLS de forma controlada)

CREATE OR REPLACE FUNCTION public.submit_acolhimento_request(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
BEGIN
  v_school_id := (payload->>'school_id')::UUID;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = v_school_id AND s.deleted_at IS NULL AND s.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Escola ou EMEI inválida';
  END IF;

  INSERT INTO public.requests (
    school_id,
    school_nome_snapshot,
    tipo_escola,
    regiao_escola,
    solicitante_email,
    solicitante_nome,
    solicitante_cargo,
    solicitante_nome_cargo,
    solicitante_telefone,
    modalidade_acolhimento,
    aluno_nome,
    aluno_nascimento,
    aluno_sexo,
    educacao_especial,
    aluno_serie,
    aluno_turma,
    aluno_turma_ano,
    periodo,
    comunicou_abuso,
    situacao_observada,
    acolhido_anteriormente,
    autorizacao_ata,
    tipo_queixa,
    descricao,
    status
  ) VALUES (
    v_school_id,
    NULLIF(trim(payload->>'school_nome'), ''),
    (payload->>'tipo_escola')::public.school_tipo,
    NULLIF(trim(payload->>'regiao_escola'), ''),
    NULLIF(trim(payload->>'solicitante_email'), ''),
    NULLIF(trim(payload->>'solicitante_nome'), ''),
    NULLIF(trim(payload->>'solicitante_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_nome_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_telefone'), ''),
    NULLIF(trim(payload->>'modalidade_acolhimento'), ''),
    NULLIF(trim(payload->>'aluno_nome'), ''),
    (payload->>'aluno_nascimento')::DATE,
    NULLIF(trim(payload->>'aluno_sexo'), ''),
    (payload->>'educacao_especial')::BOOLEAN,
    NULLIF(trim(payload->>'aluno_serie'), ''),
    NULLIF(trim(payload->>'aluno_turma'), ''),
    NULLIF(trim(payload->>'aluno_turma_ano'), ''),
    NULLIF(trim(payload->>'periodo'), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'comunicou_abuso')), ARRAY[]::TEXT[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'situacao_observada')), ARRAY[]::TEXT[]),
    (payload->>'acolhido_anteriormente')::BOOLEAN,
    NULLIF(trim(payload->>'autorizacao_ata'), ''),
    (payload->>'tipo_queixa')::public.complaint_type,
    COALESCE(NULLIF(trim(payload->>'descricao'), ''), ''),
    'recebida'::public.request_status
  )
  RETURNING requests.id, requests.numero INTO v_id, v_numero;

  INSERT INTO public.activity_logs (request_id, actor_label, action, details)
  VALUES (
    v_id,
    'Formulário público',
    'solicitacao_criada',
    jsonb_build_object('numero', v_numero, 'situacao_observada', payload->'situacao_observada')
  );

  RETURN QUERY SELECT v_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_acolhimento_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_acolhimento_request(JSONB) TO anon, authenticated;
