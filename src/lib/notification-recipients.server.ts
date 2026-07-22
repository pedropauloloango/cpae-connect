export type NotificationModule = "acolhimento" | "vivencias";

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return email;
}

/** Consulta simples e direta nas flags do perfil. */
async function fetchEmailsFromProfiles(module: NotificationModule): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const flag = module === "acolhimento" ? "receive_acolhimento_emails" : "receive_vivencias_emails";

  // Query mínima: só e-mail onde a flag do módulo é true
  const query =
    module === "acolhimento"
      ? supabaseAdmin.from("profiles").select("email").eq("receive_acolhimento_emails", true)
      : supabaseAdmin.from("profiles").select("email").eq("receive_vivencias_emails", true);

  const { data, error } = await query;

  if (error) {
    console.error(`[notify] Erro ao ler profiles.${flag}:`, error.message, error.code);
    throw error;
  }

  const emails = (data ?? [])
    .map((row) => normalizeEmail(row.email))
    .filter((e): e is string => Boolean(e));

  console.info(`[notify] profiles.${flag}=true →`, emails);
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
 * Destinatários de alerta: somente usuários com
 * E-mail alerta Acolhimento / Vivências = true no banco.
 */
export async function fetchNotificationEmails(
  module: NotificationModule,
): Promise<string[]> {
  console.info(`[notify] Resolvendo destinatários (${module})`, {
    supabaseHost: process.env.SUPABASE_URL?.replace(/^https?:\/\//, "").split("/")[0] ?? "(missing)",
  });

  // 1) Preferência: query direta (mais simples e previsível)
  try {
    const fromProfiles = await fetchEmailsFromProfiles(module);
    if (fromProfiles.length > 0) return fromProfiles;
  } catch (err) {
    console.warn(`[notify] Fallback para RPC após falha no select (${module})`, err);
  }

  // 2) Fallback: função SQL
  const fromRpc = await fetchEmailsViaRpc(module);
  if (fromRpc.length > 0) return fromRpc;

  console.warn(
    `[notify] Nenhum destinatário para ${module}. Confira profiles.receive_${module}_emails = true.`,
  );
  return [];
}
