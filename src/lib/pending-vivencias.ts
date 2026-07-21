import { supabase } from "@/integrations/supabase/client";

export const PENDING_VIVENCIA_APPROVALS_QUERY_KEY = ["pending-vivencia-approvals"] as const;
export const PENDING_VIVENCIA_CORRECTIONS_QUERY_KEY = ["pending-vivencia-corrections"] as const;
export const PENDING_VIVENCIA_RECEIVED_QUERY_KEY = ["pending-vivencia-received"] as const;
export const PENDING_VIVENCIA_ASSIGNMENTS_QUERY_KEY = ["pending-vivencia-assignments"] as const;

export type VivenciaReceivedNotification = {
  id: string;
  numero: string;
  school_nome_snapshot: string | null;
  tipo_escola: string | null;
  status: string;
  created_at: string;
};

export type VivenciaReportNotification = {
  id: string;
  status: string;
  submitted_at: string | null;
  updated_at: string | null;
  vivencia_request: {
    id: string;
    numero: string;
    school_nome_snapshot: string | null;
    tipo_escola: string | null;
  };
};

export type VivenciaAssignmentNotification = {
  id: string;
  numero: string;
  school_nome_snapshot: string | null;
  tipo_escola: string | null;
  status: string;
  assigned_at: string | null;
};

export async function fetchReceivedVivenciaRequests(): Promise<VivenciaReceivedNotification[]> {
  const { data, error } = await supabase
    .from("vivencia_requests")
    .select("id, numero, school_nome_snapshot, tipo_escola, status, created_at")
    .eq("status", "recebida")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as VivenciaReceivedNotification[];
}

export async function fetchPendingVivenciaApprovals(): Promise<VivenciaReportNotification[]> {
  const { data, error } = await supabase
    .from("vivencia_reports")
    .select(
      "id, status, submitted_at, updated_at, vivencia_request:vivencia_requests!inner(id, numero, school_nome_snapshot, tipo_escola, deleted_at)",
    )
    .eq("status", "aguardando_aprovacao")
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as VivenciaReportNotification[]).filter(
    (row) => !(row.vivencia_request as { deleted_at?: string | null }).deleted_at,
  );
}

export async function fetchPendingVivenciaCorrections(): Promise<VivenciaReportNotification[]> {
  const { data, error } = await supabase
    .from("vivencia_reports")
    .select(
      "id, status, submitted_at, updated_at, vivencia_request:vivencia_requests!inner(id, numero, school_nome_snapshot, tipo_escola, deleted_at)",
    )
    .in("status", ["correcao_solicitada", "rejeitado"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as VivenciaReportNotification[]).filter(
    (row) => !(row.vivencia_request as { deleted_at?: string | null }).deleted_at,
  );
}

export async function fetchProfessionalVivenciaAssignments(): Promise<
  VivenciaAssignmentNotification[]
> {
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
    .from("vivencia_request_assignees")
    .select(
      "assigned_at, vivencia_request:vivencia_requests!inner(id, numero, school_nome_snapshot, tipo_escola, status, deleted_at)",
    )
    .eq("professional_id", professional.id)
    .order("assigned_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const req = row.vivencia_request as {
        id: string;
        numero: string;
        school_nome_snapshot: string | null;
        tipo_escola: string | null;
        status: string;
        deleted_at: string | null;
      } | null;
      if (!req || req.deleted_at || req.status !== "distribuida") return null;
      return {
        id: req.id,
        numero: req.numero,
        school_nome_snapshot: req.school_nome_snapshot,
        tipo_escola: req.tipo_escola,
        status: req.status,
        assigned_at: row.assigned_at as string | null,
      };
    })
    .filter((x): x is VivenciaAssignmentNotification => Boolean(x));
}
