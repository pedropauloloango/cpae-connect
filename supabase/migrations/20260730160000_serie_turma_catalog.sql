-- Cadastro de Séries e Turmas (catálogo para formulários).

CREATE TABLE IF NOT EXISTS public.school_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_series_value_unique UNIQUE (value)
);

CREATE TABLE IF NOT EXISTS public.school_turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_turmas_value_unique UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_school_series_active_sort
  ON public.school_series (sort_order, label)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_turmas_active_sort
  ON public.school_turmas (sort_order, label)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_school_series_updated ON public.school_series;
CREATE TRIGGER trg_school_series_updated
  BEFORE UPDATE ON public.school_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_school_turmas_updated ON public.school_turmas;
CREATE TRIGGER trg_school_turmas_updated
  BEFORE UPDATE ON public.school_turmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.school_series TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_series TO authenticated;
GRANT ALL ON public.school_series TO service_role;

GRANT SELECT ON public.school_turmas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_turmas TO authenticated;
GRANT ALL ON public.school_turmas TO service_role;

ALTER TABLE public.school_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_turmas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_series_public_select" ON public.school_series;
CREATE POLICY "school_series_public_select" ON public.school_series
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "school_series_admin_all" ON public.school_series;
CREATE POLICY "school_series_admin_all" ON public.school_series
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "school_turmas_public_select" ON public.school_turmas;
CREATE POLICY "school_turmas_public_select" ON public.school_turmas
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "school_turmas_admin_all" ON public.school_turmas;
CREATE POLICY "school_turmas_admin_all" ON public.school_turmas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.school_series (value, label, sort_order) VALUES
  ('grupo_1', 'Grupo 1', 10),
  ('grupo_2', 'Grupo 2', 20),
  ('grupo_3', 'Grupo 3', 30),
  ('grupo_4', 'Grupo 4', 40),
  ('grupo_5', 'Grupo 5', 50),
  ('1', '1º ano', 60),
  ('2', '2º ano', 70),
  ('3', '3º ano', 80),
  ('4', '4º ano', 90),
  ('5', '5º ano', 100),
  ('6', '6º ano', 110),
  ('7', '7º ano', 120),
  ('8', '8º ano', 130),
  ('9', '9º ano', 140)
ON CONFLICT (value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL;

INSERT INTO public.school_turmas (value, label, sort_order) VALUES
  ('A', 'A', 10),
  ('B', 'B', 20),
  ('C', 'C', 30),
  ('D', 'D', 40),
  ('E', 'E', 50),
  ('F', 'F', 60),
  ('G', 'G', 70),
  ('H', 'H', 80),
  ('I', 'I', 90),
  ('J', 'J', 100)
ON CONFLICT (value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    deleted_at = NULL;
