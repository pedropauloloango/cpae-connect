import {
  buildAdminAcolhimentoEmail,
  buildSolicitanteAcolhimentoEmail,
  type AcolhimentoEmailPayload,
} from "@/lib/acolhimento-email-content";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";

async function fetchAdminEmails(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { adminEmails } = getEmailConfig();

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (rolesError) throw rolesError;

  const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];
  let fromProfiles: string[] = [];

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("email, account_status")
      .in("id", userIds);
    if (profilesError) throw profilesError;

    fromProfiles = (profiles ?? [])
      .filter((p) => {
        if (!p.email?.trim()) return false;
        if (p.account_status === "pendente" || p.account_status === "rejeitado") return false;
        return true;
      })
      .map((p) => p.email!.trim());
  }

  return [...new Set([...fromProfiles, ...adminEmails].map((e) => e.toLowerCase()))];
}

export async function sendAcolhimentoCreatedEmails(data: AcolhimentoEmailPayload): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[acolhimento-notify] E-mail não configurado — notificações ignoradas.");
    return;
  }

  const { appUrl } = getEmailConfig();
  const adminEmails = await fetchAdminEmails();
  const adminContent = buildAdminAcolhimentoEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteAcolhimentoEmail(data);

  const tasks: Promise<void>[] = [];

  if (adminEmails.length > 0) {
    tasks.push(
      sendEmail({
        to: adminEmails,
        subject: `Nova solicitação de acolhimento — ${data.numero} — ${data.aluno_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    );
  } else {
    console.warn("[acolhimento-notify] Nenhum e-mail de administrador encontrado.");
  }

  if (data.solicitante_email.trim()) {
    tasks.push(
      sendEmail({
        to: data.solicitante_email.trim(),
        subject: `Solicitação registrada — Protocolo ${data.numero}`,
        html: solicitanteContent.html,
        text: solicitanteContent.text,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[acolhimento-notify] Falha ao enviar e-mail:", result.reason);
    }
  }
}
