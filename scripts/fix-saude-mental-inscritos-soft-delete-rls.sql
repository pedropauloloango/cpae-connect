-- Corrige RLS que impede excluir inscrição (soft delete com deleted_at).
-- Execute no SQL Editor do Supabase se a exclusão retornar erro de row-level security.

DROP POLICY IF EXISTS saude_mental_inscritos_update ON public.saude_mental_inscritos;
CREATE POLICY saude_mental_inscritos_update ON public.saude_mental_inscritos
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.excluir_saude_mental_inscrito(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.user_id = auth.uid()
        AND p.deleted_at IS NULL
        AND p.status = 'ativo'
        AND p.atende_saude_mental = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir inscrição';
  END IF;

  UPDATE public.saude_mental_inscritos
  SET deleted_at = now()
  WHERE id = p_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada ou já excluída';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_saude_mental_inscrito(UUID) TO authenticated;
