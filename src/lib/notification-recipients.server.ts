import { getEmailConfig } from "@/lib/email.server";

/** Destinatários de alerta: opt-in no perfil + lista opcional do .env. */
export async function fetchNotificationEmails(): Promise<string[]> {
  const { adminEmails } = getEmailConfig();
  const fromProfiles: string[] = [];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("email, account_status, receive_notification_emails")
      .eq("receive_notification_emails", true)
      .eq("account_status", "aprovado");

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
        const email = p.email?.trim().toLowerCase();
        if (email) fromProfiles.push(email);
      }
    }
  } catch (err) {
    console.error("[notify] Erro ao resolver destinatários opt-in:", err);
  }

  return [
    ...new Set([
      ...fromProfiles,
      ...adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
    ]),
  ];
}
