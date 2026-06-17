-- PARTE 2 — Execute após add-request-status-em-ajuste.sql (parte 1) concluir com sucesso
-- Só rode se a parte 1 foi apenas: ALTER TYPE ... ADD VALUE 'em_ajuste'

UPDATE public.requests r
SET status = 'em_ajuste'
WHERE r.status = 'em_andamento'
  AND EXISTS (
    SELECT 1 FROM public.case_closures cc
    WHERE cc.request_id = r.id
      AND cc.status IN ('correcao_solicitada', 'rejeitado')
  );
