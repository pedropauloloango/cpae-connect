import {
  buildAdminAcolhimentoEmail,
  buildSolicitanteAcolhimentoEmail,
  type AcolhimentoEmailPayload,
} from "@/lib/acolhimento-email-content";
import { fetchNotificationEmails } from "@/lib/notification-recipients.server";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";

export type NotifySendResult = {
  ok: boolean;
  adminRecipients: string[];
  adminSent: number;
  solicitanteSent: boolean;
  errors: string[];
};

export async function sendAcolhimentoCreatedEmails(
  data: AcolhimentoEmailPayload,
): Promise<NotifySendResult> {
  const result: NotifySendResult = {
    ok: true,
    adminRecipients: [],
    adminSent: 0,
    solicitanteSent: false,
    errors: [],
  };

  if (!isEmailConfigured()) {
    const msg = "[acolhimento-notify] E-mail não configurado — notificações ignoradas.";
    console.warn(msg);
    result.ok = false;
    result.errors.push(msg);
    return result;
  }

  const { appUrl } = getEmailConfig();
  const notifyEmails = await fetchNotificationEmails("acolhimento");
  result.adminRecipients = notifyEmails;

  const adminContent = buildAdminAcolhimentoEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteAcolhimentoEmail(data);
  const solicitante = data.solicitante_email.trim();

  const tasks: Array<{ kind: "admin" | "solicitante"; promise: Promise<void> }> = [];

  for (const email of notifyEmails) {
    tasks.push({
      kind: "admin",
      promise: sendEmail({
        to: email,
        subject: `Nova solicitação de acolhimento — ${data.numero} — ${data.aluno_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    });
  }

  if (notifyEmails.length === 0) {
    const msg =
      "[acolhimento-notify] Nenhum destinatário com alerta Acolhimento ativo (profile/RPC/env).";
    console.warn(msg);
    result.errors.push(msg);
  }

  if (solicitante) {
    tasks.push({
      kind: "solicitante",
      promise: sendEmail({
        to: solicitante,
        subject: `Solicitação de ACOLHIMENTO registrada — Protocolo ${data.numero}`,
        html: solicitanteContent.html,
        text: solicitanteContent.text,
      }),
    });
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  settled.forEach((item, index) => {
    const kind = tasks[index]?.kind;
    if (item.status === "fulfilled") {
      if (kind === "admin") result.adminSent += 1;
      if (kind === "solicitante") result.solicitanteSent = true;
      return;
    }
    const reason = item.reason instanceof Error ? item.reason.message : String(item.reason);
    console.error("[acolhimento-notify] Falha ao enviar e-mail:", reason);
    result.errors.push(reason);
    result.ok = false;
  });

  console.info("[acolhimento-notify] resultado", result);
  return result;
}
