-- Rodar no SQL Editor do Supabase se a migration ainda não foi aplicada.
-- Protocolo diário / Relatório de Vivências Escolares (1 por demanda)

CREATE TABLE IF NOT EXISTS public.vivencia_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vivencia_request_id UUID NOT NULL UNIQUE REFERENCES public.vivencia_requests(id) ON DELETE CASCADE,
  unidade_escolar TEXT,
  ano TEXT,
  turma TEXT,
  turno TEXT,
  data_vivencia DATE,
  tema TEXT,
  quantitativo_alunos INTEGER,
  tecnicos_cpae TEXT,
  relato_atendimento TEXT NOT NULL DEFAULT '',
  direcao TEXT,
  coordenacao TEXT,
  status public.report_status NOT NULL DEFAULT 'rascunho',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vivencia_reports_request
  ON public.vivencia_reports(vivencia_request_id);
CREATE INDEX IF NOT EXISTS idx_vivencia_reports_status
  ON public.vivencia_reports(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vivencia_reports TO authenticated;
GRANT ALL ON public.vivencia_reports TO service_role;
ALTER TABLE public.vivencia_reports ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_vivencia_reports_updated ON public.vivencia_reports;
CREATE TRIGGER trg_vivencia_reports_updated
  BEFORE UPDATE ON public.vivencia_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "vivencia_reports_admin_all" ON public.vivencia_reports;
CREATE POLICY "vivencia_reports_admin_all" ON public.vivencia_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "vivencia_reports_professional_select" ON public.vivencia_reports;
CREATE POLICY "vivencia_reports_professional_select" ON public.vivencia_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_reports.vivencia_request_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "vivencia_reports_professional_insert" ON public.vivencia_reports;
CREATE POLICY "vivencia_reports_professional_insert" ON public.vivencia_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_reports.vivencia_request_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "vivencia_reports_professional_update" ON public.vivencia_reports;
CREATE POLICY "vivencia_reports_professional_update" ON public.vivencia_reports FOR UPDATE TO authenticated
  USING (
    status IN ('rascunho', 'rejeitado', 'correcao_solicitada')
    AND EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_reports.vivencia_request_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vivencia_request_assignees a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.vivencia_request_id = vivencia_reports.vivencia_request_id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );
