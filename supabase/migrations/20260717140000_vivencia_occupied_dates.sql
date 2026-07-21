-- Datas preferíveis já solicitadas por região + período (formulário público).
CREATE OR REPLACE FUNCTION public.get_vivencia_occupied_dates(
  p_regiao text,
  p_periodo text
)
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
  )
  SELECT DISTINCT g.data_preferivel
  FROM public.vivencia_request_groups g
  JOIN public.vivencia_requests r ON r.id = g.vivencia_request_id
  LEFT JOIN public.schools s ON s.id = r.school_id
  CROSS JOIN norm
  WHERE r.deleted_at IS NULL
    AND r.status IS DISTINCT FROM 'cancelada'
    AND g.data_preferivel IS NOT NULL
    AND g.periodo = p_periodo
    AND nullif(norm.regiao_key, '') IS NOT NULL
    AND (
      lower(trim(both from translate(
        coalesce(r.regiao_escola, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
      ))) = norm.regiao_key
      OR lower(trim(both from translate(
        coalesce(s.regiao, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
      ))) = norm.regiao_key
    );
$$;

REVOKE ALL ON FUNCTION public.get_vivencia_occupied_dates(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vivencia_occupied_dates(text, text) TO anon, authenticated;
