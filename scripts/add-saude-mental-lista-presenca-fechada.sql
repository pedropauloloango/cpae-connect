-- Rode no SQL Editor do Supabase após as migrations de encontros/presença.

ALTER TABLE public.saude_mental_encontros
  ADD COLUMN IF NOT EXISTS lista_presenca_fechada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saude_mental_encontros.lista_presenca_fechada IS
  'Quando true, inscritos sem registro de presença neste encontro são considerados ausentes na visualização.';

-- Reabrir listas sem nenhuma presença (útil após limpar saude_mental_presencas no banco):
-- UPDATE public.saude_mental_encontros SET lista_presenca_fechada = false WHERE id NOT IN (SELECT DISTINCT encontro_id FROM public.saude_mental_presencas);
