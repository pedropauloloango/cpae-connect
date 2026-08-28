-- Fechamento da lista manual: inscritos sem presença passam a contar como ausência (bolinha vermelha).

ALTER TABLE public.saude_mental_encontros
  ADD COLUMN IF NOT EXISTS lista_presenca_fechada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saude_mental_encontros.lista_presenca_fechada IS
  'Quando true, inscritos sem registro de presença neste encontro são considerados ausentes na visualização.';
