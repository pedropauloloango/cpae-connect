-- Módulo Vivências e Palestras (separado do Acolhimento)

CREATE SEQUENCE IF NOT EXISTS public.vivencia_request_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.vivencia_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT (
    'VIV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.vivencia_request_number_seq')::text, 6, '0')
  ),
  school_id UUID REFERENCES public.schools(id),
  school_nome_snapshot TEXT,
  tipo_escola public.school_tipo,
  regiao_escola TEXT,
  solicitante_email TEXT,
  solicitante_nome TEXT,
  solicitante_cargo TEXT,
  solicitante_telefone TEXT,
  palestra_tema TEXT,
  data_preferivel_vivencia DATE,
  data_preferivel_palestra DATE,
  status public.request_status NOT NULL DEFAULT 'recebida',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vivencia_requests_status
  ON public.vivencia_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vivencia_requests_school
  ON public.vivencia_requests(school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vivencia_requests_created
  ON public.vivencia_requests(created_at DESC) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vivencia_requests TO authenticated;
GRANT ALL ON public.vivencia_requests TO service_role;
ALTER TABLE public.vivencia_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_vivencia_requests_updated ON public.vivencia_requests;
CREATE TRIGGER trg_vivencia_requests_updated
  BEFORE UPDATE ON public.vivencia_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vivencia_request_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivencia_request_id UUID NOT NULL REFERENCES public.vivencia_requests(id) ON DELETE CASCADE,
  aluno_serie TEXT NOT NULL,
  aluno_turma TEXT NOT NULL,
  periodo TEXT NOT NULL,
  temas TEXT[] NOT NULL DEFAULT '{}',
  data_preferivel DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Para bancos onde a tabela já existia sem a coluna de data por turma
ALTER TABLE public.vivencia_request_groups
  ADD COLUMN IF NOT EXISTS data_preferivel DATE;

CREATE INDEX IF NOT EXISTS idx_vivencia_request_groups_request
  ON public.vivencia_request_groups(vivencia_request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vivencia_request_groups TO authenticated;
GRANT ALL ON public.vivencia_request_groups TO service_role;
ALTER TABLE public.vivencia_request_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vivencia_request_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivencia_request_id UUID NOT NULL REFERENCES public.vivencia_requests(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (vivencia_request_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_vivencia_assignees_request
  ON public.vivencia_request_assignees(vivencia_request_id);
CREATE INDEX IF NOT EXISTS idx_vivencia_assignees_professional
  ON public.vivencia_request_assignees(professional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vivencia_request_assignees TO authenticated;
GRANT ALL ON public.vivencia_request_assignees TO service_role;
ALTER TABLE public.vivencia_request_assignees ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vivencia_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivencia_request_id UUID NOT NULL REFERENCES public.vivencia_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_label TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vivencia_activity_logs_request
  ON public.vivencia_activity_logs(vivencia_request_id, created_at DESC);

GRANT SELECT, INSERT ON public.vivencia_activity_logs TO authenticated;
GRANT ALL ON public.vivencia_activity_logs TO service_role;
ALTER TABLE public.vivencia_activity_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS vivencia_request_id UUID REFERENCES public.vivencia_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_vivencia_request
  ON public.appointments(vivencia_request_id)
  WHERE vivencia_request_id IS NOT NULL;

-- Policies (depois de todas as tabelas)
DROP POLICY IF EXISTS "vivencia_requests_admin_all" ON public.vivencia_requests;
CREATE POLICY "vivencia_requests_admin_all" ON public.vivencia_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_requests_professional_select" ON public.vivencia_requests;
CREATE POLICY "vivencia_requests_professional_select" ON public.vivencia_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_requests.id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vivencia_requests_professional_update" ON public.vivencia_requests;
CREATE POLICY "vivencia_requests_professional_update" ON public.vivencia_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_requests.id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_requests.id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vivencia_groups_admin_all" ON public.vivencia_request_groups;
CREATE POLICY "vivencia_groups_admin_all" ON public.vivencia_request_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_groups_professional_select" ON public.vivencia_request_groups;
CREATE POLICY "vivencia_groups_professional_select" ON public.vivencia_request_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_request_groups.vivencia_request_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vivencia_assignees_admin_all" ON public.vivencia_request_assignees;
CREATE POLICY "vivencia_assignees_admin_all" ON public.vivencia_request_assignees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_assignees_professional_select" ON public.vivencia_request_assignees;
CREATE POLICY "vivencia_assignees_professional_select" ON public.vivencia_request_assignees FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "vivencia_logs_admin_all" ON public.vivencia_activity_logs;
CREATE POLICY "vivencia_logs_admin_all" ON public.vivencia_activity_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_logs_professional_select" ON public.vivencia_activity_logs;
CREATE POLICY "vivencia_logs_professional_select" ON public.vivencia_activity_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_activity_logs.vivencia_request_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vivencia_logs_professional_insert" ON public.vivencia_activity_logs;
CREATE POLICY "vivencia_logs_professional_insert" ON public.vivencia_activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_activity_logs.vivencia_request_id
        AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.submit_vivencia_request(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT)
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

  RETURN QUERY SELECT v_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_vivencia_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vivencia_request(JSONB) TO anon, authenticated;
