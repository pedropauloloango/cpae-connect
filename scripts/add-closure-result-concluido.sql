-- Adiciona "Concluído" às opções de resultado do relatório consolidado.
ALTER TYPE public.closure_result ADD VALUE IF NOT EXISTS 'concluido';
