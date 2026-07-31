-- Restaura séries/turmas soft-deleted (deleted_at preenchido).
-- Execute no SQL Editor do Supabase se quiser reativar todas de uma vez.

-- Conferência:
SELECT id, value, label, deleted_at
FROM public.school_series
WHERE deleted_at IS NOT NULL
ORDER BY sort_order, label;

SELECT id, value, label, deleted_at
FROM public.school_turmas
WHERE deleted_at IS NOT NULL
ORDER BY sort_order, label;

-- Restaurar todas as séries excluídas:
UPDATE public.school_series
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL;

-- Restaurar todas as turmas excluídas:
UPDATE public.school_turmas
SET deleted_at = NULL
WHERE deleted_at IS NOT NULL;
