-- Faz o submit público devolver os e-mails com alerta ativo (mesma conexão do insert).
-- Execute no SQL Editor do Supabase.

-- Precisa DROP: o retorno mudou de (id, numero) para (id, numero, alert_emails)
DROP FUNCTION IF EXISTS public.submit_acolhimento_request(JSONB);
DROP FUNCTION IF EXISTS public.submit_vivencia_request(JSONB);

-- ========== ACOLHIMENTO ==========
CREATE OR REPLACE FUNCTION public.submit_acolhimento_request(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT, alert_emails TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
  v_alerts TEXT[];
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

  SELECT COALESCE(array_agg(DISTINCT lower(trim(p.email))), ARRAY[]::TEXT[])
  INTO v_alerts
  FROM public.profiles p
  WHERE p.receive_acolhimento_emails IS TRUE
    AND p.email IS NOT NULL
    AND length(trim(p.email)) > 3
    AND coalesce(p.account_status::text, 'aprovado') <> 'rejeitado';

  RETURN QUERY SELECT v_id, v_numero, COALESCE(v_alerts, ARRAY[]::TEXT[]);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_acolhimento_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_acolhimento_request(JSONB) TO anon, authenticated;

-- ========== VIVÊNCIAS ==========
CREATE OR REPLACE FUNCTION public.submit_vivencia_request(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT, alert_emails TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
  v_group JSONB;
  v_idx INT := 0;
  v_temas TEXT[];
  v_has_groups BOOLEAN;
  v_palestra TEXT;
  v_alerts TEXT[];
BEGIN
  v_school_id := (payload->>'school_id')::UUID;
  v_palestra := NULLIF(trim(payload->>'palestra_tema'), '');
  v_has_groups := jsonb_typeof(payload->'groups') = 'array'
    AND jsonb_array_length(payload->'groups') > 0;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = v_school_id AND s.deleted_at IS NULL AND s.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Escola ou EMEI inválida';
  END IF;

  IF NOT v_has_groups AND v_palestra IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um grupo de vivência ou uma palestra';
  END IF;

  INSERT INTO public.vivencia_requests (
    school_id,
    school_nome_snapshot,
    tipo_escola,
    regiao_escola,
    solicitante_email,
    solicitante_nome,
    solicitante_cargo,
    solicitante_telefone,
    palestra_tema,
    data_preferivel_vivencia,
    data_preferivel_palestra,
    status
  ) VALUES (
    v_school_id,
    NULLIF(trim(payload->>'school_nome'), ''),
    (payload->>'tipo_escola')::public.school_tipo,
    NULLIF(trim(payload->>'regiao_escola'), ''),
    NULLIF(trim(payload->>'solicitante_email'), ''),
    NULLIF(trim(payload->>'solicitante_nome'), ''),
    NULLIF(trim(payload->>'solicitante_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_telefone'), ''),
    v_palestra,
    NULLIF(trim(payload->>'data_preferivel_vivencia'), '')::DATE,
    NULLIF(trim(payload->>'data_preferivel_palestra'), '')::DATE,
    'recebida'::public.request_status
  )
  RETURNING vivencia_requests.id, vivencia_requests.numero INTO v_id, v_numero;

  IF v_has_groups THEN
    FOR v_group IN SELECT * FROM jsonb_array_elements(payload->'groups')
    LOOP
      v_temas := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_group->'temas')),
        ARRAY[]::TEXT[]
      );
      IF array_length(v_temas, 1) IS NULL OR array_length(v_temas, 1) < 1 THEN
        RAISE EXCEPTION 'Cada grupo de vivência precisa de ao menos um tema';
      END IF;

      INSERT INTO public.vivencia_request_groups (
        vivencia_request_id,
        aluno_serie,
        aluno_turma,
        periodo,
        temas,
        data_preferivel,
        sort_order
      ) VALUES (
        v_id,
        NULLIF(trim(v_group->>'aluno_serie'), ''),
        NULLIF(trim(v_group->>'aluno_turma'), ''),
        NULLIF(trim(v_group->>'periodo'), ''),
        v_temas,
        NULLIF(trim(v_group->>'data_preferivel'), '')::DATE,
        v_idx
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  INSERT INTO public.vivencia_activity_logs (vivencia_request_id, actor_label, action, details)
  VALUES (
    v_id,
    'Formulário público',
    'solicitacao_criada',
    jsonb_build_object(
      'numero', v_numero,
      'groups_count', v_idx,
      'palestra_tema', v_palestra
    )
  );

  SELECT COALESCE(array_agg(DISTINCT lower(trim(p.email))), ARRAY[]::TEXT[])
  INTO v_alerts
  FROM public.profiles p
  WHERE p.receive_vivencias_emails IS TRUE
    AND p.email IS NOT NULL
    AND length(trim(p.email)) > 3
    AND coalesce(p.account_status::text, 'aprovado') <> 'rejeitado';

  RETURN QUERY SELECT v_id, v_numero, COALESCE(v_alerts, ARRAY[]::TEXT[]);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_vivencia_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vivencia_request(JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
