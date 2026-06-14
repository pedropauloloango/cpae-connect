-- Cole este arquivo no SQL Editor do Supabase Dashboard
-- Ordem: schema → security patch → bucket → storage policies

-- ========== 20260612171654 (schema principal) ==========

-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'profissional');
CREATE TYPE public.professional_status AS ENUM ('ativo', 'ferias', 'licenca', 'inativo');
CREATE TYPE public.school_status AS ENUM ('ativa', 'inativa');
CREATE TYPE public.request_status AS ENUM ('recebida', 'distribuida', 'em_andamento', 'aguardando_aprovacao', 'concluida', 'cancelada');
CREATE TYPE public.complaint_type AS ENUM ('ansiedade_depressao', 'violacao_direitos', 'ideacao_suicida', 'bullying', 'conflito_familiar', 'outros');
CREATE TYPE public.meeting_number AS ENUM ('primeiro', 'segundo', 'terceiro');
CREATE TYPE public.meeting_type AS ENUM ('acolhimento', 'visita_tecnica', 'reuniao', 'outros');
CREATE TYPE public.report_status AS ENUM ('rascunho', 'aguardando_aprovacao', 'aprovado', 'rejeitado', 'correcao_solicitada');
CREATE TYPE public.closure_result AS ENUM ('resolvido', 'encaminhado', 'em_acompanhamento', 'nao_localizado');

-- ============== HELPER: updated_at ==============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== SCHOOLS ==============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_siger TEXT,
  codigo_inep TEXT,
  nome TEXT NOT NULL,
  endereco TEXT,
  bairro TEXT,
  cep TEXT,
  regiao TEXT,
  email TEXT,
  ramal TEXT,
  tipologia TEXT,
  diretor_nome TEXT,
  diretor_celular TEXT,
  diretor_cpf TEXT,
  diretor_adjunto_nome TEXT,
  diretor_adjunto_celular TEXT,
  status public.school_status NOT NULL DEFAULT 'ativa',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_schools_regiao ON public.schools(regiao) WHERE deleted_at IS NULL;
CREATE INDEX idx_schools_status ON public.schools(status) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT SELECT ON public.schools TO anon;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_select_public" ON public.schools FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "schools_admin_all" ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== PROFESSIONALS ==============
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  matricula TEXT,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  especialidade TEXT,
  regiao_atuacao TEXT,
  status public.professional_status NOT NULL DEFAULT 'ativo',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_professionals_status ON public.professionals(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_professionals_user ON public.professionals(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professionals_select_auth" ON public.professionals FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "professionals_admin_all" ON public.professionals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_professionals_updated BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== REQUESTS ==============
CREATE SEQUENCE public.request_number_seq START 1;
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT ('ACO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.request_number_seq')::text, 6, '0')),
  school_id UUID REFERENCES public.schools(id),
  school_nome_snapshot TEXT,
  diretor_responsavel TEXT,
  diretor_telefone TEXT,
  aluno_nome TEXT NOT NULL,
  aluno_nascimento DATE,
  aluno_serie TEXT,
  aluno_turma TEXT,
  responsavel_nome TEXT,
  responsavel_telefone TEXT,
  tipo_queixa public.complaint_type NOT NULL,
  descricao TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'recebida',
  assigned_professional_id UUID REFERENCES public.professionals(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requests_status ON public.requests(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_school ON public.requests(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_professional ON public.requests(assigned_professional_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_created ON public.requests(created_at DESC) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_admin_all" ON public.requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "requests_professional_select" ON public.requests FOR SELECT TO authenticated
  USING (assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE POLICY "requests_professional_update" ON public.requests FOR UPDATE TO authenticated
  USING (assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
  WITH CHECK (assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== APPOINTMENTS ==============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id),
  school_id UUID REFERENCES public.schools(id),
  titulo TEXT NOT NULL,
  tipo public.meeting_type NOT NULL DEFAULT 'acolhimento',
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_inicio ON public.appointments(inicio);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments_admin_all" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "appointments_professional_own" ON public.appointments FOR ALL TO authenticated
  USING (professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
  WITH CHECK (professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== MEETINGS ==============
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id),
  numero public.meeting_number NOT NULL,
  tipo public.meeting_type NOT NULL DEFAULT 'acolhimento',
  data_atendimento TIMESTAMPTZ NOT NULL,
  relato_texto TEXT,
  relato_anexo_url TEXT,
  observacoes TEXT,
  status public.report_status NOT NULL DEFAULT 'rascunho',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, numero)
);
CREATE INDEX idx_meetings_request ON public.meetings(request_id);
CREATE INDEX idx_meetings_status ON public.meetings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_admin_all" ON public.meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "meetings_professional_own" ON public.meetings FOR ALL TO authenticated
  USING (professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
  WITH CHECK (professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== APPROVALS ==============
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('aprovado', 'rejeitado', 'correcao_solicitada')),
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_meeting ON public.approvals(meeting_id);
GRANT SELECT, INSERT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_admin_all" ON public.approvals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "approvals_professional_view" ON public.approvals FOR SELECT TO authenticated
  USING (meeting_id IN (SELECT id FROM public.meetings WHERE professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())));

-- ============== ATTACHMENTS ==============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_request ON public.attachments(request_id);
CREATE INDEX idx_attachments_meeting ON public.attachments(meeting_id);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_admin_all" ON public.attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "attachments_professional_view" ON public.attachments FOR SELECT TO authenticated
  USING (
    request_id IN (SELECT id FROM public.requests WHERE assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
    OR meeting_id IN (SELECT id FROM public.meetings WHERE professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()))
  );
CREATE POLICY "attachments_professional_insert" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- ============== CASE CLOSURES ==============
CREATE TABLE public.case_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.requests(id) ON DELETE CASCADE,
  classificacao_final public.complaint_type NOT NULL,
  parecer_final TEXT NOT NULL,
  documento_final_url TEXT,
  resultado public.closure_result NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_closures TO authenticated;
GRANT ALL ON public.case_closures TO service_role;
ALTER TABLE public.case_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closures_admin_all" ON public.case_closures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "closures_professional_view" ON public.case_closures FOR SELECT TO authenticated
  USING (request_id IN (SELECT id FROM public.requests WHERE assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())));

-- ============== ACTIVITY LOGS ==============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_label TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_request ON public.activity_logs(request_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_admin_all" ON public.activity_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "logs_professional_view" ON public.activity_logs FOR SELECT TO authenticated
  USING (request_id IN (SELECT id FROM public.requests WHERE assigned_professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())));
CREATE POLICY "logs_authenticated_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ========== 20260612171713 (security patch) ==========
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "logs_authenticated_insert" ON public.activity_logs;
CREATE POLICY "logs_authenticated_insert" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ========== 20260612180000 (storage bucket) ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'acolhimento-anexos',
  'acolhimento-anexos',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- ========== 20260612171810 (storage policies) ==========
CREATE POLICY "anexos_public_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'acolhimento-anexos' AND (storage.foldername(name))[1] = 'public');

CREATE POLICY "anexos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'acolhimento-anexos' AND (storage.foldername(name))[1] = 'authenticated');

CREATE POLICY "anexos_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'acolhimento-anexos');

CREATE POLICY "anexos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'acolhimento-anexos' AND public.has_role(auth.uid(), 'admin'));

-- ========== 20260612200000 (aprovação de usuários) ==========
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'pendente';

UPDATE public.profiles p
SET account_status = 'aprovado'
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'pendente')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_admin_select" ON public.user_roles FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== 20260613120000 (formulário oficial acolhimento) ==========
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT,
  ADD COLUMN IF NOT EXISTS regiao_escola TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_nome_cargo TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_telefone TEXT,
  ADD COLUMN IF NOT EXISTS modalidade_acolhimento TEXT,
  ADD COLUMN IF NOT EXISTS educacao_especial BOOLEAN,
  ADD COLUMN IF NOT EXISTS aluno_turma_ano TEXT,
  ADD COLUMN IF NOT EXISTS periodo TEXT,
  ADD COLUMN IF NOT EXISTS comunicou_abuso TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS situacao_observada TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acolhido_anteriormente BOOLEAN,
  ADD COLUMN IF NOT EXISTS autorizacao_ata TEXT;

ALTER TABLE public.requests ALTER COLUMN descricao DROP NOT NULL;
ALTER TABLE public.requests ALTER COLUMN descricao SET DEFAULT '';
ALTER TABLE public.requests ALTER COLUMN tipo_queixa DROP NOT NULL;

-- ========== 20260613130000 (tipo escola) ==========
DO $$ BEGIN
  CREATE TYPE public.school_tipo AS ENUM ('escola', 'emei');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tipo_escola public.school_tipo NOT NULL DEFAULT 'escola';

-- ========== 20260613140000 (tipo escola na solicitação) ==========
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS tipo_escola public.school_tipo;

-- ========== 20260613150000 (nome e cargo do solicitante) ==========
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_cargo TEXT;

-- ========== 20260613160000 (sexo do aluno) ==========
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS aluno_sexo TEXT;

-- ========== 20260613170000 (envio público formulário acolhimento — RPC) ==========
CREATE OR REPLACE FUNCTION public.submit_acolhimento_request(payload JSONB)
RETURNS TABLE (id UUID, numero TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_id UUID;
  v_numero TEXT;
BEGIN
  v_school_id := (payload->>'school_id')::UUID;
  IF NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = v_school_id AND s.deleted_at IS NULL AND s.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Escola ou EMEI inválida';
  END IF;
  INSERT INTO public.requests (
    school_id, school_nome_snapshot, tipo_escola, regiao_escola,
    solicitante_email, solicitante_nome, solicitante_cargo, solicitante_nome_cargo, solicitante_telefone,
    modalidade_acolhimento, aluno_nome, aluno_nascimento, aluno_sexo, educacao_especial,
    aluno_serie, aluno_turma, aluno_turma_ano, periodo,
    comunicou_abuso, situacao_observada, acolhido_anteriormente, autorizacao_ata,
    tipo_queixa, descricao, status
  ) VALUES (
    v_school_id,
    NULLIF(trim(payload->>'school_nome'), ''),
    (payload->>'tipo_escola')::public.school_tipo,
    NULLIF(trim(payload->>'regiao_escola'), ''),
    NULLIF(trim(payload->>'solicitante_email'), ''),
    NULLIF(trim(payload->>'solicitante_nome'), ''),
    NULLIF(trim(payload->>'solicitante_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_nome_cargo'), ''),
    NULLIF(trim(payload->>'solicitante_telefone'), ''),
    NULLIF(trim(payload->>'modalidade_acolhimento'), ''),
    NULLIF(trim(payload->>'aluno_nome'), ''),
    (payload->>'aluno_nascimento')::DATE,
    NULLIF(trim(payload->>'aluno_sexo'), ''),
    (payload->>'educacao_especial')::BOOLEAN,
    NULLIF(trim(payload->>'aluno_serie'), ''),
    NULLIF(trim(payload->>'aluno_turma'), ''),
    NULLIF(trim(payload->>'aluno_turma_ano'), ''),
    NULLIF(trim(payload->>'periodo'), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'comunicou_abuso')), ARRAY[]::TEXT[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'situacao_observada')), ARRAY[]::TEXT[]),
    (payload->>'acolhido_anteriormente')::BOOLEAN,
    NULLIF(trim(payload->>'autorizacao_ata'), ''),
    (payload->>'tipo_queixa')::public.complaint_type,
    COALESCE(NULLIF(trim(payload->>'descricao'), ''), ''),
    'recebida'::public.request_status
  )
  RETURNING requests.id, requests.numero INTO v_id, v_numero;
  INSERT INTO public.activity_logs (request_id, actor_label, action, details)
  VALUES (v_id, 'Formulário público', 'solicitacao_criada', jsonb_build_object('numero', v_numero, 'situacao_observada', payload->'situacao_observada'));
  RETURN QUERY SELECT v_id, v_numero;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_acolhimento_request(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_acolhimento_request(JSONB) TO anon, authenticated;
