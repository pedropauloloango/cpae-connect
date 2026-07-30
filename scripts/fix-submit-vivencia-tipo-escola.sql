-- Corrige submit_vivencia_request: cast de tipo_escola (erro 42804).
-- Execute no SQL Editor do Supabase e tente enviar de novo.

DROP FUNCTION IF EXISTS public.submit_vivencia_request(JSONB);

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
  v_hora TEXT;
  v_hora_palestra TEXT;
BEGIN
  v_school_id := (payload->>'school_id')::UUID;
  v_palestra := NULLIF(trim(payload->>'palestra_tema'), '');
  v_hora_palestra := NULLIF(trim(payload->>'hora_inicio_palestra'), '');
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
    hora_inicio_palestra,
    status
  ) VALUES (
    v_school_id,
    NULLIF(trim(payload->>'school_nome'), ''),
    NULLIF(trim(payload->>'tipo_escola'), '')::public.school_tipo,
    NULLIF(trim(payload->>'regiao_escola'), ''),
    NULLIF(trim(payload->>'solicitante_email'), ''),
    NULLIF(trim(payload->>'solicitante_nome'), ''),
    NULLIF(trim(payload->>'solicitante_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_telefone'), ''),
    v_palestra,
    NULLIF(trim(payload->>'data_preferivel_vivencia'), '')::DATE,
    NULLIF(trim(payload->>'data_preferivel_palestra'), '')::DATE,
    CASE
      WHEN v_hora_palestra IS NULL THEN NULL
      ELSE v_hora_palestra::TIME
    END,
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

      v_hora := NULLIF(trim(v_group->>'hora_inicio'), '');

      INSERT INTO public.vivencia_request_groups (
        vivencia_request_id,
        aluno_serie,
        aluno_turma,
        periodo,
        temas,
        data_preferivel,
        hora_inicio,
        sort_order
      ) VALUES (
        v_id,
        NULLIF(trim(v_group->>'aluno_serie'), ''),
        NULLIF(trim(v_group->>'aluno_turma'), ''),
        NULLIF(trim(v_group->>'periodo'), ''),
        v_temas,
        NULLIF(trim(v_group->>'data_preferivel'), '')::DATE,
        CASE
          WHEN v_hora IS NULL THEN NULL
          ELSE v_hora::TIME
        END,
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
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.receive_vivencias_emails IS TRUE
    AND ur.role::text IN ('admin', 'super_admin')
    AND p.email IS NOT NULL
    AND length(trim(p.email)) > 3
    AND coalesce(p.account_status::text, 'aprovado') <> 'rejeitado';

  RETURN QUERY SELECT v_id, v_numero, COALESCE(v_alerts, ARRAY[]::TEXT[]);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_vivencia_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vivencia_request(JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
