-- Corrige demandas com relatório aprovado, mas status ainda "em_andamento".
-- Execute no SQL Editor do Supabase.

-- Conferência:
SELECT
  r.id,
  r.numero,
  r.status AS status_demanda,
  c.status AS status_relatorio,
  r.aluno_nome
FROM public.requests r
INNER JOIN public.case_closures c ON c.request_id = r.id
WHERE c.status = 'aprovado'
  AND r.status IS DISTINCT FROM 'concluida';

-- Correção:
UPDATE public.requests r
SET status = 'concluida'
FROM public.case_closures c
WHERE c.request_id = r.id
  AND c.status = 'aprovado'
  AND r.status IS DISTINCT FROM 'concluida';

-- Esta demanda específica (se ainda estiver inconsistente):
-- UPDATE public.requests
-- SET status = 'concluida'
-- WHERE id = '0ba9b47a-1125-43a2-ad61-ea0e225cf058';
