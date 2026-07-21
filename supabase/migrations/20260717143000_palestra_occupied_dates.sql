-- Datas ocupadas para palestra por região: inclui palestras e vivências já solicitadas.
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
      )
  )
  SELECT DISTINCT occupied.data_preferivel
  FROM (
    SELECT r.data_preferivel_palestra AS data_preferivel
    FROM public.vivencia_requests r
    JOIN same_region sr ON sr.id = r.id
    WHERE r.data_preferivel_palestra IS NOT NULL

    UNION

    SELECT g.data_preferivel
    FROM public.vivencia_request_groups g
    JOIN same_region sr ON sr.id = g.vivencia_request_id
    WHERE g.data_preferivel IS NOT NULL
  ) occupied;
$$;

REVOKE ALL ON FUNCTION public.get_palestra_occupied_dates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_palestra_occupied_dates(text) TO anon, authenticated;
