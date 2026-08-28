-- Encontros (módulos do curso) + presença via QR / manual

CREATE TABLE IF NOT EXISTS public.saude_mental_encontros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  horario TIME NOT NULL,
  local TEXT NOT NULL,
  modulo_curso TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'realizado')),
  ano_curso INTEGER NOT NULL DEFAULT 2026,
  qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  qr_ativo BOOLEAN NOT NULL DEFAULT false,
  qr_expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saude_mental_encontros IS
  'Encontros/aulas do Curso de Saúde Mental na Educação.';
COMMENT ON COLUMN public.saude_mental_encontros.modulo_curso IS
  'Identificação do módulo do curso (ex.: Módulo 1).';
COMMENT ON COLUMN public.saude_mental_encontros.qr_token IS
  'Token público da URL de presença por QR Code.';
COMMENT ON COLUMN public.saude_mental_encontros.qr_ativo IS
  'Quando true e dentro de qr_expires_at, a URL pública aceita confirmação de presença.';
COMMENT ON COLUMN public.saude_mental_encontros.qr_expires_at IS
  'Fim da janela de recebimento de presença via QR.';

CREATE INDEX IF NOT EXISTS idx_saude_mental_encontros_data
  ON public.saude_mental_encontros(data DESC, horario DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_encontros_ano
  ON public.saude_mental_encontros(ano_curso)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_saude_mental_encontros_qr
  ON public.saude_mental_encontros(qr_token)
  WHERE deleted_at IS NULL AND qr_ativo = true;

CREATE TABLE IF NOT EXISTS public.saude_mental_presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id UUID NOT NULL REFERENCES public.saude_mental_encontros(id) ON DELETE CASCADE,
  inscrito_id UUID NOT NULL REFERENCES public.saude_mental_inscritos(id),
  cpf_informado TEXT,
  origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('qrcode', 'manual')),
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (encontro_id, inscrito_id)
);

COMMENT ON TABLE public.saude_mental_presencas IS
  'Presenças de inscritos em encontros do curso Saúde Mental.';

CREATE INDEX IF NOT EXISTS idx_saude_mental_presencas_encontro
  ON public.saude_mental_presencas(encontro_id);
CREATE INDEX IF NOT EXISTS idx_saude_mental_presencas_inscrito
  ON public.saude_mental_presencas(inscrito_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saude_mental_encontros TO authenticated;
GRANT ALL ON public.saude_mental_encontros TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saude_mental_presencas TO authenticated;
GRANT ALL ON public.saude_mental_presencas TO service_role;

ALTER TABLE public.saude_mental_encontros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saude_mental_presencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saude_mental_encontros_select ON public.saude_mental_encontros;
CREATE POLICY saude_mental_encontros_select ON public.saude_mental_encontros
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS saude_mental_encontros_insert ON public.saude_mental_encontros;
CREATE POLICY saude_mental_encontros_insert ON public.saude_mental_encontros
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS saude_mental_encontros_update ON public.saude_mental_encontros;
CREATE POLICY saude_mental_encontros_update ON public.saude_mental_encontros
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS saude_mental_encontros_delete ON public.saude_mental_encontros;
CREATE POLICY saude_mental_encontros_delete ON public.saude_mental_encontros
  FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS saude_mental_presencas_select ON public.saude_mental_presencas;
CREATE POLICY saude_mental_presencas_select ON public.saude_mental_presencas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS saude_mental_presencas_insert ON public.saude_mental_presencas;
CREATE POLICY saude_mental_presencas_insert ON public.saude_mental_presencas
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS saude_mental_presencas_update ON public.saude_mental_presencas;
CREATE POLICY saude_mental_presencas_update ON public.saude_mental_presencas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS saude_mental_presencas_delete ON public.saude_mental_presencas;
CREATE POLICY saude_mental_presencas_delete ON public.saude_mental_presencas
  FOR DELETE TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_saude_mental_encontros_updated ON public.saude_mental_encontros;
CREATE TRIGGER trg_saude_mental_encontros_updated
  BEFORE UPDATE ON public.saude_mental_encontros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public lookup by token (sempre retorna o encontro; recebimento só se ativo e não expirado)
DROP FUNCTION IF EXISTS public.get_saude_mental_encontro_qr(UUID);
CREATE OR REPLACE FUNCTION public.get_saude_mental_encontro_qr(p_token UUID)
RETURNS TABLE (
  id UUID,
  data DATE,
  horario TIME,
  local TEXT,
  modulo_curso TEXT,
  ano_curso INTEGER,
  qr_ativo BOOLEAN,
  qr_expires_at TIMESTAMPTZ,
  recebimento_aberto BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ativo BOOLEAN;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT e.id, e.qr_ativo, e.qr_expires_at
  INTO v_id, v_ativo, v_expires
  FROM public.saude_mental_encontros e
  WHERE e.qr_token = p_token
    AND e.deleted_at IS NULL;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  IF v_ativo AND v_expires IS NOT NULL AND v_expires <= now() THEN
    UPDATE public.saude_mental_encontros
    SET qr_ativo = false
    WHERE id = v_id;
    v_ativo := false;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.data,
    e.horario,
    e.local,
    e.modulo_curso,
    e.ano_curso,
    v_ativo,
    e.qr_expires_at,
    (v_ativo AND e.qr_expires_at IS NOT NULL AND e.qr_expires_at > now())
  FROM public.saude_mental_encontros e
  WHERE e.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_saude_mental_encontro_qr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saude_mental_encontro_qr(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_presenca_saude_mental(
  p_token UUID,
  p_cpf TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  mensagem TEXT,
  nome_completo TEXT,
  ja_registrado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf TEXT;
  v_encontro_id UUID;
  v_ano INTEGER;
  v_ativo BOOLEAN;
  v_expires TIMESTAMPTZ;
  v_inscrito_id UUID;
  v_nome TEXT;
  v_existing UUID;
BEGIN
  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_cpf) <> 11 THEN
    RETURN QUERY SELECT false, 'Informe um CPF válido com 11 dígitos.'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  SELECT e.id, e.ano_curso, e.qr_ativo, e.qr_expires_at
  INTO v_encontro_id, v_ano, v_ativo, v_expires
  FROM public.saude_mental_encontros e
  WHERE e.qr_token = p_token
    AND e.deleted_at IS NULL;

  IF v_encontro_id IS NULL THEN
    RETURN QUERY SELECT false, 'QR Code inválido para este encontro.'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  IF v_ativo AND v_expires IS NOT NULL AND v_expires <= now() THEN
    UPDATE public.saude_mental_encontros
    SET qr_ativo = false
    WHERE id = v_encontro_id;
    v_ativo := false;
  END IF;

  IF NOT v_ativo OR v_expires IS NULL OR v_expires <= now() THEN
    RETURN QUERY SELECT
      false,
      'Recebimento de presença não está liberado ou a janela expirou.'::TEXT,
      NULL::TEXT,
      false;
    RETURN;
  END IF;

  SELECT i.id, i.nome_completo
  INTO v_inscrito_id, v_nome
  FROM public.saude_mental_inscritos i
  WHERE i.deleted_at IS NULL
    AND i.ano_curso = v_ano
    AND regexp_replace(COALESCE(i.cpf, ''), '[^0-9]', '', 'g') = v_cpf
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_inscrito_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      'CPF não encontrado entre os inscritos deste ano do curso.'::TEXT,
      NULL::TEXT,
      false;
    RETURN;
  END IF;

  SELECT p.id INTO v_existing
  FROM public.saude_mental_presencas p
  WHERE p.encontro_id = v_encontro_id
    AND p.inscrito_id = v_inscrito_id;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT true, 'Presença já registrada anteriormente.'::TEXT, v_nome, true;
    RETURN;
  END IF;

  INSERT INTO public.saude_mental_presencas (
    encontro_id,
    inscrito_id,
    cpf_informado,
    origem
  ) VALUES (
    v_encontro_id,
    v_inscrito_id,
    v_cpf,
    'qrcode'
  );

  RETURN QUERY SELECT true, 'Presença confirmada com sucesso.'::TEXT, v_nome, false;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_presenca_saude_mental(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_presenca_saude_mental(UUID, TEXT) TO anon, authenticated;
