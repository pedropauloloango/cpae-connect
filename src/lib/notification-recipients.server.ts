/** Destinatários de alerta: usuários aprovados com preferência ativada. */
export async function fetchNotificationEmails(): Promise<string[]> {
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
      return [];
    }
    throw error;
  }

  return [
    ...new Set(
      (profiles ?? [])
        .map((p) => p.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
}
