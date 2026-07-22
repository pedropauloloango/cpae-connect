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
  const solicitante = data.solicitante_email.trim().toLowerCase();

  const tasks: Promise<void>[] = [];

  // Um envio por destinatário (mais confiável no MailerSend do que lote único)
  for (const email of notifyEmails) {
    if (email === solicitante) continue; // evita duplicar se admin = solicitante
    tasks.push(
      sendEmail({
        to: email,
        subject: `Nova solicitação de acolhimento — ${data.numero} — ${data.aluno_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    );
  }

  if (notifyEmails.length === 0) {
    console.warn(
      "[acolhimento-notify] Nenhum destinatário de alerta (opt-in / ADMIN_NOTIFICATION_EMAILS).",
    );
  }

  if (solicitante) {
    tasks.push(
      sendEmail({
        to: solicitante,
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
