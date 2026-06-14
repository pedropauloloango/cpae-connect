import { supabase } from "@/integrations/supabase/client";

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string | null;
  account_status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
  roles: ("admin" | "profissional")[];
  professional: { id: string; nome: string } | null;
};

/** Lista usuários via Supabase client (RLS). Evita server function + auth.admin no Node. */
export async function fetchUsersAdmin(): Promise<AdminUserRow[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: pros, error: proErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, account_status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("professionals").select("id, nome, user_id").is("deleted_at", null),
    ]);

  if (pErr) {
    if (pErr.message.includes("account_status")) {
      throw new Error(
        "Coluna profiles.account_status não existe. Execute scripts/fix-usuarios-module.sql no SQL Editor do Supabase.",
      );
    }
    throw pErr;
  }
  if (rErr) throw rErr;
  if (proErr) throw proErr;

  const rolesByUser = new Map<string, ("admin" | "profissional")[]>();
  (roles ?? []).forEach((r) => {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  });

  const proByUser = new Map<string, { id: string; nome: string }>();
  (pros ?? []).forEach((p) => {
    if (p.user_id) proByUser.set(p.user_id, { id: p.id, nome: p.nome });
  });

  return (profiles ?? []).map((profile) => {
    const userRoles = rolesByUser.get(profile.id) ?? [];
    let status = (profile.account_status ?? "pendente") as AdminUserRow["account_status"];
    if (!profile.account_status && userRoles.length > 0) status = "aprovado";

    return {
      id: profile.id,
      full_name: profile.full_name ?? "",
      email: profile.email,
      account_status: status,
      created_at: profile.created_at,
      roles: userRoles,
      professional: proByUser.get(profile.id) ?? null,
    };
  });
}
