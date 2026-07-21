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
  const notifyEmails = await fetchNotificationEmails();
  const adminContent = buildAdminVivenciaEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteVivenciaEmail(data);

  const tasks: Promise<void>[] = [];

  if (notifyEmails.length > 0) {
    tasks.push(
      sendEmail({
        to: notifyEmails,
        subject: `Nova solicitação de vivências — ${data.numero} — ${data.school_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    );
  } else {
    console.warn(
      "[vivencias-notify] Nenhum usuário com 'Receber e-mail de notificação' ativado.",
    );
  }

  if (data.solicitante_email.trim()) {
    tasks.push(
      sendEmail({
        to: data.solicitante_email.trim(),
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
