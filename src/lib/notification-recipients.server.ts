import { getEmailConfig } from "@/lib/email.server";

export type NotificationModule = "acolhimento" | "vivencias";

/**
 * Destinatários de alerta por módulo (opt-in no perfil).
 * ADMIN_NOTIFICATION_EMAILS do ambiente entra como fallback para ambos.
 */
export async function fetchNotificationEmails(
  module: NotificationModule,
): Promise<string[]> {
  const { adminEmails } = getEmailConfig();
  const fromProfiles: string[] = [];
  const flagColumn =
    module === "acolhimento" ? "receive_acolhimento_emails" : "receive_vivencias_emails";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(`id, email, account_status, ${flagColumn}`)
      .eq(flagColumn, true);

    if (error) {
      if (
        error.message.includes("receive_acolhimento_emails") ||
        error.message.includes("receive_vivencias_emails") ||
        error.code === "PGRST204"
      ) {
        console.warn(
          `[notify] Coluna ${flagColumn} ausente — execute scripts/fix-module-notification-emails.sql`,
        );
      } else {
        console.error(`[notify] Falha ao buscar destinatários (${module}):`, error.message);
      }
    } else {
      for (const p of profiles ?? []) {
        if (p.account_status === "rejeitado" || p.account_status === "pendente") continue;

        let email = p.email?.trim().toLowerCase() ?? "";

        if (!email) {
          try {
            const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(p.id);
            if (!authErr) email = authUser.user?.email?.trim().toLowerCase() ?? "";
          } catch (authCatch) {
            console.warn(`[notify] Falha ao buscar e-mail auth de ${p.id}:`, authCatch);
          }
        }

        if (email) fromProfiles.push(email);
        else console.warn(`[notify] Usuário opt-in (${module}) sem e-mail: ${p.id}`);
      }
    }
  } catch (err) {
    console.error(`[notify] Erro ao resolver destinatários (${module}):`, err);
  }

  const merged = [
    ...new Set([
      ...fromProfiles,
      ...adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
    ]),
  ];

  console.info(`[notify] Destinatários ${module}: ${merged.length}`, merged);
  return merged;
}
