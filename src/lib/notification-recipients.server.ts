export type NotificationModule = "acolhimento" | "vivencias";

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return email;
}

const ADMIN_ROLES = ["admin", "super_admin"] as const;

/** Consulta direta: flag do módulo = true e papel admin/super_admin. */
async function fetchEmailsFromProfiles(module: NotificationModule): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const flag = module === "acolhimento" ? "receive_acolhimento_emails" : "receive_vivencias_emails";

  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", [...ADMIN_ROLES]);

  if (rolesErr) {
    console.error("[notify] Erro ao ler user_roles:", rolesErr.message, rolesErr.code);
    throw rolesErr;
  }

  const adminIds = [...new Set((roles ?? []).map((r) => r.user_id).filter(Boolean))];
  if (adminIds.length === 0) {
    console.info(`[notify] Nenhum admin/super_admin encontrado (${module})`);
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq(flag, true)
    .in("id", adminIds)
    .neq("account_status", "rejeitado");

  if (error) {
    console.error(`[notify] Erro ao ler profiles.${flag}:`, error.message, error.code);
    throw error;
  }

  const emails = (data ?? [])
    .map((row) => normalizeEmail(row.email))
    .filter((e): e is string => Boolean(e));

  console.info(`[notify] profiles.${flag}=true (admins) →`, emails);
  return [...new Set(emails)];
}

async function fetchEmailsViaRpc(module: NotificationModule): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_notification_recipient_emails", {
    p_module: module,
  });

  if (error) {
    console.warn(`[notify] RPC indisponível (${module}):`, error.message);
    return [];
  }

  const emails = (data ?? [])
    .map((row: { email?: string } | string) =>
      normalizeEmail(typeof row === "string" ? row : row.email),
    )
    .filter((e): e is string => Boolean(e));

  console.info(`[notify] RPC ${module} →`, emails);
  return [...new Set(emails)];
}

/**
 * Destinatários de alerta: somente Administradores / Super Admins com
 * E-mail alerta Acolhimento / Vivências = true no banco.
 * Sempre resolve no servidor (não confia em listas vindas do formulário público).
 */
export async function fetchNotificationEmails(
  module: NotificationModule,
): Promise<string[]> {
  console.info(`[notify] Resolvendo destinatários (${module})`, {
    supabaseHost: process.env.SUPABASE_URL?.replace(/^https?:\/\//, "").split("/")[0] ?? "(missing)",
  });

  try {
    return await fetchEmailsFromProfiles(module);
  } catch (err) {
    console.warn(`[notify] Fallback para RPC após falha no select (${module})`, err);
  }

  const fromRpc = await fetchEmailsViaRpc(module);
  if (fromRpc.length > 0) return fromRpc;

  console.warn(
    `[notify] Nenhum destinatário para ${module}. Confira profiles.receive_${module}_emails = true em um admin.`,
  );
  return [];
}
