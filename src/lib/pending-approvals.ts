import { supabase } from "@/integrations/supabase/client";

export const PENDING_APPROVALS_QUERY_KEY = ["pending-approvals"] as const;
export const PENDING_CORRECTIONS_QUERY_KEY = ["pending-corrections"] as const;
export const PENDING_RECEIVED_REQUESTS_QUERY_KEY = ["pending-received-requests"] as const;
export const PENDING_ASSIGNMENTS_QUERY_KEY = ["pending-assignments"] as const;

export type ReceivedRequestNotification = {
  id: string;
  numero: string;
  aluno_nome: string;
  school_nome_snapshot: string | null;
  tipo_escola: string | null;
  status: string;
  created_at: string;
};

export type ClosureNotification = {
  id: string;
  status: string;
  relato_texto: string | null;
  relato_anexo_url: string | null;
  classificacao_final: string;
  resultado: string;
  submitted_at: string | null;
  updated_at: string | null;
  request: {
    id: string;
    numero: string;
    aluno_nome: string;
    school_nome_snapshot: string | null;
    professional: { nome: string } | null;
  };
};

export type PendingClosure = ClosureNotification;

export type ProfessionalAssignmentNotification = {
  id: string;
  numero: string;
  aluno_nome: string;
  school_nome_snapshot: string | null;
  tipo_escola: string | null;
  status: string;
  assigned_at: string | null;
};

export async function fetchPendingApprovals(): Promise<PendingClosure[]> {
  const { data, error } = await supabase
    .from("case_closures")
    .select(
      "id, status, relato_texto, relato_anexo_url, classificacao_final, resultado, submitted_at, updated_at, request:requests!inner(id, numero, aluno_nome, school_nome_snapshot, professional:professionals!assigned_professional_id(nome))",
    )
    .eq("status", "aguardando_aprovacao")
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PendingClosure[];
}

export async function fetchPendingProfessionalCorrections(): Promise<ClosureNotification[]> {
  const { data, error } = await supabase
    .from("case_closures")
    .select(
      "id, status, relato_texto, relato_anexo_url, classificacao_final, resultado, submitted_at, updated_at, request:requests!inner(id, numero, aluno_nome, school_nome_snapshot, professional:professionals!assigned_professional_id(nome))",
    )
    .in("status", ["correcao_solicitada", "rejeitado"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ClosureNotification[];
}

export async function fetchReceivedRequests(): Promise<ReceivedRequestNotification[]> {
  const { data, error } = await supabase
    .from("requests")
    .select("id, numero, aluno_nome, school_nome_snapshot, tipo_escola, status, created_at")
    .eq("status", "recebida")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ReceivedRequestNotification[];
}

export async function fetchProfessionalAssignments(): Promise<ProfessionalAssignmentNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (professionalError) throw professionalError;
  if (!professional?.id) return [];

  const { data, error } = await supabase
    .from("requests")
    .select("id, numero, aluno_nome, school_nome_snapshot, tipo_escola, status, assigned_at")
    .eq("assigned_professional_id", professional.id)
    .eq("status", "distribuida")
    .is("deleted_at", null)
    .order("assigned_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfessionalAssignmentNotification[];
}
