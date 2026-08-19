ALTER TABLE public.vivencia_requests
  ADD COLUMN IF NOT EXISTS hora_inicio_palestra TIME;

CREATE TABLE IF NOT EXISTS public.vivencia_request_palestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivencia_request_id UUID NOT NULL REFERENCES public.vivencia_requests(id) ON DELETE CASCADE,
  aluno_serie TEXT NOT NULL,
  aluno_turma TEXT NOT NULL,
  periodo TEXT NOT NULL,
  palestra_tema TEXT NOT NULL,
  data_preferivel DATE,
  hora_inicio TIME,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vivencia_request_palestras_request
  ON public.vivencia_request_palestras(vivencia_request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vivencia_request_palestras TO authenticated;
GRANT ALL ON public.vivencia_request_palestras TO service_role;
ALTER TABLE public.vivencia_request_palestras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vivencia_palestras_admin_all" ON public.vivencia_request_palestras;
CREATE POLICY "vivencia_palestras_admin_all" ON public.vivencia_request_palestras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_palestras_professional_select" ON public.vivencia_request_palestras;
CREATE POLICY "vivencia_palestras_professional_select" ON public.vivencia_request_palestras FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_request_palestras.vivencia_request_id
        AND p.user_id = auth.uid()
    )
  );

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
  v_palestra_item JSONB;
  v_idx INT := 0;
  v_palestra_idx INT := 0;
  v_temas TEXT[];
  v_has_groups BOOLEAN;
  v_has_palestras BOOLEAN;
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
  v_has_palestras := jsonb_typeof(payload->'palestras') = 'array'
    AND jsonb_array_length(payload->'palestras') > 0;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = v_school_id AND s.deleted_at IS NULL AND s.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Escola ou EMEI inválida';
  END IF;

  IF NOT v_has_groups AND NOT v_has_palestras AND v_palestra IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um grupo de vivência completo ou uma palestra';
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

  IF v_has_palestras THEN
    FOR v_palestra_item IN SELECT * FROM jsonb_array_elements(payload->'palestras')
    LOOP
      v_hora := NULLIF(trim(v_palestra_item->>'hora_inicio'), '');

      INSERT INTO public.vivencia_request_palestras (
        vivencia_request_id,
        aluno_serie,
        aluno_turma,
        periodo,
        palestra_tema,
        data_preferivel,
        hora_inicio,
        sort_order
      ) VALUES (
        v_id,
        NULLIF(trim(v_palestra_item->>'aluno_serie'), ''),
        NULLIF(trim(v_palestra_item->>'aluno_turma'), ''),
        NULLIF(trim(v_palestra_item->>'periodo'), ''),
        NULLIF(trim(v_palestra_item->>'palestra_tema'), ''),
        NULLIF(trim(v_palestra_item->>'data_preferivel'), '')::DATE,
        CASE
          WHEN v_hora IS NULL THEN NULL
          ELSE v_hora::TIME
        END,
        v_palestra_idx
      );
      v_palestra_idx := v_palestra_idx + 1;
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
      'palestras_count', v_palestra_idx,
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

CREATE OR REPLACE FUNCTION public.get_palestra_occupied_dates(p_regiao text)
RETURNS TABLE (data_preferivel date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT lower(trim(both from translate(
      coalesce(p_regiao, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
    ))) AS regiao_key
  ),
  same_region AS (
    SELECT r.id
    FROM public.vivencia_requests r
    LEFT JOIN public.schools s ON s.id = r.school_id
    CROSS JOIN norm
    WHERE r.deleted_at IS NULL
      AND r.status IS DISTINCT FROM 'cancelada'
      AND nullif(norm.regiao_key, '') IS NOT NULL
      AND (
        lower(trim(both from translate(coalesce(r.regiao_escola, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
        ))) = norm.regiao_key
        OR lower(trim(both from translate(coalesce(s.regiao, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
        ))) = norm.regiao_key
      )
  )
  SELECT DISTINCT occupied.data_preferivel
  FROM (
    SELECT r.data_preferivel_palestra AS data_preferivel
    FROM public.vivencia_requests r
    JOIN same_region sr ON sr.id = r.id
    WHERE r.data_preferivel_palestra IS NOT NULL

    UNION

    SELECT p.data_preferivel
    FROM public.vivencia_request_palestras p
    JOIN same_region sr ON sr.id = p.vivencia_request_id
    WHERE p.data_preferivel IS NOT NULL

    UNION

    SELECT g.data_preferivel
    FROM public.vivencia_request_groups g
    JOIN same_region sr ON sr.id = g.vivencia_request_id
    WHERE g.data_preferivel IS NOT NULL
  ) occupied;
$$;

REVOKE ALL ON FUNCTION public.submit_vivencia_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vivencia_request(JSONB) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_palestra_occupied_dates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_palestra_occupied_dates(text) TO anon, authenticated;
