-- Reabre listas de presença após apagar registros em saude_mental_presencas.
-- Encontros com lista fechada mas sem nenhuma presença voltam a exibir bolinhas cinzas (pendente).

UPDATE public.saude_mental_encontros e
SET lista_presenca_fechada = false
WHERE e.lista_presenca_fechada = true
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.saude_mental_presencas p
    WHERE p.encontro_id = e.id
  );
