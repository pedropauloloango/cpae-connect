import { getEmailConfig } from "@/lib/email.server";

/**
 * Destinatários de alerta:
 * - profiles com receive_notification_emails = true (e e-mail válido)
 * - mais ADMIN_NOTIFICATION_EMAILS do ambiente (fallback)
 */
export async function fetchNotificationEmails(): Promise<string[]> {
  const { adminEmails } = getEmailConfig();
  const fromProfiles: string[] = [];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Não exige account_status na query: quem optou e está rejeitado já tem o flag=false no fluxo de Usuários.
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, account_status, receive_notification_emails")
      .eq("receive_notification_emails", true);

    if (error) {
      if (error.message.includes("receive_notification_emails") || error.code === "PGRST204") {
        console.warn(
          "[notify] Coluna receive_notification_emails ausente — execute scripts/fix-profile-notification-emails.sql",
        );
      } else {
        console.error("[notify] Falha ao buscar destinatários opt-in:", error.message);
      }
    } else {
      for (const p of profiles ?? []) {
        if (p.account_status === "rejeitado" || p.account_status === "pendente") {
          continue;
        }

        let email = p.email?.trim().toLowerCase() ?? "";

        // Perfis sem e-mail na tabela: tenta o e-mail do Auth
        if (!email) {
          try {
            const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(p.id);
            if (authErr) {
              console.warn(`[notify] Sem e-mail no profile ${p.id}:`, authErr.message);
            } else {
              email = authUser.user?.email?.trim().toLowerCase() ?? "";
            }
          } catch (authCatch) {
            console.warn(`[notify] Falha ao buscar e-mail auth de ${p.id}:`, authCatch);
          }
        }

        if (email) fromProfiles.push(email);
        else console.warn(`[notify] Usuário opt-in sem e-mail resolvido: ${p.id}`);
      }
    }
  } catch (err) {
    console.error("[notify] Erro ao resolver destinatários opt-in:", err);
  }

  const merged = [
    ...new Set([
      ...fromProfiles,
      ...adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
    ]),
  ];

  console.info(`[notify] Destinatários de alerta: ${merged.length}`, merged);
  return merged;
}
