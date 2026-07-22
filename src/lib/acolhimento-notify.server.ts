import {
  buildAdminAcolhimentoEmail,
  buildSolicitanteAcolhimentoEmail,
  type AcolhimentoEmailPayload,
} from "@/lib/acolhimento-email-content";
import { fetchNotificationEmails } from "@/lib/notification-recipients.server";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";

export async function sendAcolhimentoCreatedEmails(data: AcolhimentoEmailPayload): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[acolhimento-notify] E-mail não configurado — notificações ignoradas.");
    return;
  }

  const { appUrl } = getEmailConfig();
  const notifyEmails = await fetchNotificationEmails();
  const adminContent = buildAdminAcolhimentoEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteAcolhimentoEmail(data);

  const tasks: Promise<void>[] = [];

  if (notifyEmails.length > 0) {
    tasks.push(
      sendEmail({
        to: notifyEmails,
        subject: `Nova solicitação de acolhimento — ${data.numero} — ${data.aluno_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    );
  } else {
    console.warn(
      "[acolhimento-notify] Nenhum destinatário de alerta (opt-in / ADMIN_NOTIFICATION_EMAILS).",
    );
  }

  if (data.solicitante_email.trim()) {
    tasks.push(
      sendEmail({
        to: data.solicitante_email.trim(),
        subject: `Solicitação de ACOLHIMENTO registrada — Protocolo ${data.numero}`,
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
