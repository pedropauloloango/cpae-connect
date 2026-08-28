-- Seed: 9 encontros do Curso de Saúde Mental 2026 (um por módulo)
-- Horário de início: 19:00 | Ano do curso: 2026
-- Local padrão: "A definir" (pode editar depois na tela Módulos)

INSERT INTO public.saude_mental_encontros (
  data,
  horario,
  local,
  modulo_curso,
  status,
  ano_curso,
  qr_ativo
)
VALUES
  ('2026-08-18', '19:00:00', 'A definir', 'Módulo 1', 'pendente', 2026, false),
  ('2026-08-31', '19:00:00', 'A definir', 'Módulo 2', 'pendente', 2026, false),
  ('2026-09-15', '19:00:00', 'A definir', 'Módulo 3', 'pendente', 2026, false),
  ('2026-09-29', '19:00:00', 'A definir', 'Módulo 4', 'pendente', 2026, false),
  ('2026-10-06', '19:00:00', 'A definir', 'Módulo 5', 'pendente', 2026, false),
  ('2026-10-20', '19:00:00', 'A definir', 'Módulo 6', 'pendente', 2026, false),
  ('2026-11-03', '19:00:00', 'A definir', 'Módulo 7', 'pendente', 2026, false),
  ('2026-11-17', '19:00:00', 'A definir', 'Módulo 8', 'pendente', 2026, false),
  ('2026-12-08', '19:00:00', 'A definir', 'Módulo 9', 'pendente', 2026, false);
