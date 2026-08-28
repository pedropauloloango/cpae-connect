-- Pré-validação de CPF antes de confirmar presença via QR

CREATE OR REPLACE FUNCTION public.validar_inscrito_presenca_qr(
  p_token UUID,
  p_cpf TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  mensagem TEXT,
  nome_completo TEXT,
  ja_registrado BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  WHERE e.qr_token = p_token AND e.deleted_at IS NULL;

  IF v_encontro_id IS NULL THEN
    RETURN QUERY SELECT false, 'QR Code inválido para este encontro.'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  IF v_ativo AND v_expires IS NOT NULL AND v_expires <= now() THEN
    UPDATE public.saude_mental_encontros SET qr_ativo = false WHERE id = v_encontro_id;
    v_ativo := false;
  END IF;

  IF NOT v_ativo OR v_expires IS NULL OR v_expires <= now() THEN
    RETURN QUERY SELECT false, 'Recebimento de presença não está liberado ou a janela expirou.'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  SELECT i.id, i.nome_completo INTO v_inscrito_id, v_nome
  FROM public.saude_mental_inscritos i
  WHERE i.deleted_at IS NULL AND i.ano_curso = v_ano
    AND regexp_replace(COALESCE(i.cpf, ''), '[^0-9]', '', 'g') = v_cpf
  ORDER BY i.created_at DESC LIMIT 1;

  IF v_inscrito_id IS NULL THEN
    RETURN QUERY SELECT false, 'Este CPF não está inscrito no Curso de Saúde Mental na Educação.'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  SELECT p.id INTO v_existing FROM public.saude_mental_presencas p
  WHERE p.encontro_id = v_encontro_id AND p.inscrito_id = v_inscrito_id;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT true, 'Presença já registrada anteriormente.'::TEXT, v_nome, true;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Inscrito encontrado.'::TEXT, v_nome, false;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_inscrito_presenca_qr(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_inscrito_presenca_qr(UUID, TEXT) TO anon, authenticated, service_role;
