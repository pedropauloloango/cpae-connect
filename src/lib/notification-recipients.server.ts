import { getEmailConfig } from "@/lib/email.server";

export type NotificationModule = "acolhimento" | "vivencias";

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) return null;
  return email;
}

async function fetchEmailsViaRpc(
  module: NotificationModule,
): Promise<{ emails: string[]; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_notification_recipient_emails", {
      p_module: module,
    });

    if (error) {
      return { emails: [], error: error.message };
    }

    const emails = (data ?? [])
      .map((row: { email?: string } | string) =>
        normalizeEmail(typeof row === "string" ? row : row.email),
      )
      .filter((e): e is string => Boolean(e));

    return { emails: [...new Set(emails)] };
  } catch (err) {
    return { emails: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchEmailsViaTableScan(
  module: NotificationModule,
): Promise<{ emails: string[]; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, account_status, receive_acolhimento_emails, receive_vivencias_emails, receive_notification_emails",
      );

    if (error) {
      return { emails: [], error: error.message };
    }

    const emails: string[] = [];

    for (const p of profiles ?? []) {
      if (p.account_status === "rejeitado") continue;

      const legacy = Boolean(p.receive_notification_emails);
      const opted =
        module === "acolhimento"
          ? Boolean(p.receive_acolhimento_emails) || legacy
          : Boolean(p.receive_vivencias_emails) || legacy;

      if (!opted) continue;

      let email = normalizeEmail(p.email);
      if (!email) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
          email = normalizeEmail(authUser.user?.email);
        } catch {
          /* ignore */
        }
      }
      if (email) emails.push(email);
    }

    return { emails: [...new Set(emails)] };
  } catch (err) {
    return { emails: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Destinatários de alerta por módulo.
 * 1) RPC no banco (mais confiável)
 * 2) Fallback: scan em profiles
 * 3) Fallback: ADMIN_NOTIFICATION_EMAILS
 */
export async function fetchNotificationEmails(
  module: NotificationModule,
): Promise<string[]> {
  const { adminEmails } = getEmailConfig();
  const envEmails = adminEmails.map((e) => normalizeEmail(e)).filter((e): e is string => Boolean(e));

  const viaRpc = await fetchEmailsViaRpc(module);
  if (viaRpc.error) {
    console.warn(`[notify] RPC get_notification_recipient_emails falhou (${module}):`, viaRpc.error);
  }

  let fromDb = viaRpc.emails;

  if (fromDb.length === 0) {
    const viaTable = await fetchEmailsViaTableScan(module);
    if (viaTable.error) {
      console.warn(`[notify] Scan profiles falhou (${module}):`, viaTable.error);
    } else {
      fromDb = viaTable.emails;
    }
  }

  const merged = [...new Set([...fromDb, ...envEmails])];
  console.info(`[notify] Destinatários ${module}: ${merged.length}`, {
    fromDb,
    fromEnv: envEmails,
    merged,
  });

  return merged;
}
