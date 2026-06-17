-- PARTE 2 de 2 — Execute somente após a Parte 1 concluir com sucesso
--
-- Atualiza encontros, encerramento consolidado e opções de encaminhamento

UPDATE public.meetings
SET status = 'registrado'
WHERE status IN ('rascunho', 'aguardando_aprovacao', 'aprovado', 'rejeitado', 'correcao_solicitada');

ALTER TABLE public.case_closures
  ADD COLUMN IF NOT EXISTS status public.report_status NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS relato_texto TEXT,
  ADD COLUMN IF NOT EXISTS relato_anexo_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.case_closures ALTER COLUMN parecer_final DROP NOT NULL;

ALTER TABLE public.approvals ALTER COLUMN meeting_id DROP NOT NULL;

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS closure_id UUID REFERENCES public.case_closures(id) ON DELETE CASCADE;

ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_target_check;

ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_target_check CHECK (
    (meeting_id IS NOT NULL AND closure_id IS NULL)
    OR (meeting_id IS NULL AND closure_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_case_closures_status ON public.case_closures(status);
CREATE INDEX IF NOT EXISTS idx_approvals_closure ON public.approvals(closure_id);

DROP TRIGGER IF EXISTS trg_case_closures_updated ON public.case_closures;
CREATE TRIGGER trg_case_closures_updated
  BEFORE UPDATE ON public.case_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  CREATE POLICY "closures_professional_own" ON public.case_closures
    FOR ALL TO authenticated
    USING (
      request_id IN (
        SELECT id FROM public.requests
        WHERE assigned_professional_id IN (
          SELECT id FROM public.professionals WHERE user_id = auth.uid()
        )
      )
    )
    WITH CHECK (
      request_id IN (
        SELECT id FROM public.requests
        WHERE assigned_professional_id IN (
          SELECT id FROM public.professionals WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "approvals_professional_view" ON public.approvals;

CREATE POLICY "approvals_professional_view" ON public.approvals
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM public.meetings
      WHERE professional_id IN (
        SELECT id FROM public.professionals WHERE user_id = auth.uid()
      )
    )
    OR closure_id IN (
      SELECT cc.id FROM public.case_closures cc
      INNER JOIN public.requests r ON r.id = cc.request_id
      WHERE r.assigned_professional_id IN (
        SELECT id FROM public.professionals WHERE user_id = auth.uid()
      )
    )
  );

DO $$ BEGIN
  CREATE TYPE public.meeting_referral_option AS ENUM (
    'ubs_ubsf',
    'clinica_escola_psicologia',
    'caps_ij',
    'rede_privada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS opcoes_encaminhamento public.meeting_referral_option[] NOT NULL DEFAULT '{}';
