-- Datas de palestra já solicitadas pela mesma escola no mesmo período.
CREATE OR REPLACE FUNCTION public.get_palestra_school_occupied_dates(
  p_school_id uuid,
  p_periodo text
)
RETURNS TABLE (data_preferivel date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.data_preferivel
  FROM public.vivencia_request_palestras p
  JOIN public.vivencia_requests r ON r.id = p.vivencia_request_id
  WHERE r.deleted_at IS NULL
    AND r.status IS DISTINCT FROM 'cancelada'
    AND r.school_id = p_school_id
    AND p.periodo = p_periodo
    AND p.data_preferivel IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_palestra_school_occupied_dates(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_palestra_school_occupied_dates(uuid, text) TO anon, authenticated;

-- Série/turma deixam de ser obrigatórias nas palestras do formulário público.
ALTER TABLE public.vivencia_request_palestras
  ALTER COLUMN aluno_serie DROP NOT NULL,
  ALTER COLUMN aluno_turma DROP NOT NULL;
