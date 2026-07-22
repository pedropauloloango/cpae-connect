import {
  buildAdminVivenciaEmail,
  buildSolicitanteVivenciaEmail,
  type VivenciaEmailPayload,
} from "@/lib/vivencias-email-content";
import { fetchNotificationEmails } from "@/lib/notification-recipients.server";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";

export async function sendVivenciaCreatedEmails(data: VivenciaEmailPayload): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[vivencias-notify] E-mail não configurado — notificações ignoradas.");
    return;
  }

  const { appUrl } = getEmailConfig();
  const notifyEmails = await fetchNotificationEmails("vivencias");
  const adminContent = buildAdminVivenciaEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteVivenciaEmail(data);
  const solicitante = data.solicitante_email.trim();

  const tasks: Promise<void>[] = [];

  for (const email of notifyEmails) {
    tasks.push(
      sendEmail({
        to: email,
        subject: `Nova solicitação de vivências — ${data.numero} — ${data.school_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    );
  }

  if (notifyEmails.length === 0) {
    console.warn(
      "[vivencias-notify] Nenhum destinatário com 'E-mail alerta Vivências' ativo.",
    );
  }

  if (solicitante) {
    tasks.push(
      sendEmail({
        to: solicitante,
        subject: `Solicitação de VIVÊNCIA registrada — Protocolo ${data.numero}`,
        html: solicitanteContent.html,
        text: solicitanteContent.text,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[vivencias-notify] Falha ao enviar e-mail:", result.reason);
    }
  }
}
