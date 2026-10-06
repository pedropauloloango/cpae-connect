-- Grava quem exclui uma inscrição de Saúde Mental.
-- Execute no SQL Editor do Supabase. É seguro executar novamente.

ALTER TABLE public.saude_mental_inscritos
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS deleted_by_nome TEXT;

COMMENT ON COLUMN public.saude_mental_inscritos.deleted_by IS
  'Usuário autenticado que excluiu a inscrição.';
COMMENT ON COLUMN public.saude_mental_inscritos.deleted_by_nome IS
  'Nome do usuário no momento da exclusão.';

CREATE OR REPLACE FUNCTION public.saude_mental_inscrito_nome_usuario(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(p.full_name), ''), p.email)
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_saude_mental_inscritos_deleted_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid());
    IF NEW.deleted_by_nome IS NULL AND NEW.deleted_by IS NOT NULL THEN
      NEW.deleted_by_nome := public.saude_mental_inscrito_nome_usuario(NEW.deleted_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saude_mental_inscritos_deleted_by ON public.saude_mental_inscritos;
CREATE TRIGGER trg_saude_mental_inscritos_deleted_by
  BEFORE UPDATE ON public.saude_mental_inscritos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_saude_mental_inscritos_deleted_by();

CREATE OR REPLACE FUNCTION public.excluir_saude_mental_inscrito(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.user_id = v_uid
        AND p.deleted_at IS NULL
        AND p.status = 'ativo'
        AND p.atende_saude_mental = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir inscrição';
  END IF;

  UPDATE public.saude_mental_inscritos
  SET
    deleted_at = now(),
    deleted_by = v_uid,
    deleted_by_nome = public.saude_mental_inscrito_nome_usuario(v_uid)
  WHERE id = p_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada ou já excluída';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_saude_mental_inscrito(UUID) TO authenticated;
