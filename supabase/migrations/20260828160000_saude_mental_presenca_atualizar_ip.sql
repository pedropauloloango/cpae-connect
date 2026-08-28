-- Atualiza IP em presença já registrada (chamada pelo servidor após confirmação no browser)

CREATE OR REPLACE FUNCTION public.atualizar_presenca_ip_saude_mental(
  p_token UUID,
  p_cpf TEXT,
  p_client_ip TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf TEXT;
  v_encontro_id UUID;
  v_ano INTEGER;
  v_inscrito_id UUID;
  v_ip TEXT;
  v_rows INTEGER;
BEGIN
  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_cpf) <> 11 THEN
    RETURN false;
  END IF;

  v_ip := NULLIF(trim(COALESCE(p_client_ip, '')), '');
  IF v_ip IS NULL THEN
    RETURN false;
  END IF;
  IF length(v_ip) > 45 THEN
    v_ip := left(v_ip, 45);
  END IF;

  SELECT e.id, e.ano_curso
  INTO v_encontro_id, v_ano
  FROM public.saude_mental_encontros e
  WHERE e.qr_token = p_token
    AND e.deleted_at IS NULL;

  IF v_encontro_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT i.id
  INTO v_inscrito_id
  FROM public.saude_mental_inscritos i
  WHERE i.deleted_at IS NULL
    AND i.ano_curso = v_ano
    AND regexp_replace(COALESCE(i.cpf, ''), '[^0-9]', '', 'g') = v_cpf
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_inscrito_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.saude_mental_presencas p
  SET registrado_ip = v_ip
  WHERE p.encontro_id = v_encontro_id
    AND p.inscrito_id = v_inscrito_id
    AND (p.registrado_ip IS NULL OR btrim(p.registrado_ip) = '');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_presenca_ip_saude_mental(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_presenca_ip_saude_mental(UUID, TEXT, TEXT) TO service_role;
