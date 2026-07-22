import {
  buildAdminVivenciaEmail,
  buildSolicitanteVivenciaEmail,
  type VivenciaEmailPayload,
} from "@/lib/vivencias-email-content";
import { fetchNotificationEmails } from "@/lib/notification-recipients.server";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";
import type { NotifySendResult } from "@/lib/acolhimento-notify.server";

export async function sendVivenciaCreatedEmails(
  data: VivenciaEmailPayload,
): Promise<NotifySendResult> {
  const result: NotifySendResult = {
    ok: true,
    adminRecipients: [],
    adminSent: 0,
    solicitanteSent: false,
    errors: [],
  };

  if (!isEmailConfigured()) {
    const msg = "[vivencias-notify] E-mail não configurado — notificações ignoradas.";
    console.warn(msg);
    result.ok = false;
    result.errors.push(msg);
    return result;
  }

  const { appUrl } = getEmailConfig();
  const fromSubmit = (data.alertEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const fromDb = fromSubmit.length > 0 ? [] : await fetchNotificationEmails("vivencias");
  const notifyEmails = [...new Set(fromSubmit.length > 0 ? fromSubmit : fromDb)];
  result.adminRecipients = notifyEmails;

  console.info("[vivencias-notify] alert recipients", {
    fromSubmit,
    fromDb,
    notifyEmails,
  });

  const adminContent = buildAdminVivenciaEmail(data, appUrl);
  const solicitanteContent = buildSolicitanteVivenciaEmail(data);
  const solicitante = data.solicitante_email.trim();

  const tasks: Array<{ kind: "admin" | "solicitante"; promise: Promise<void> }> = [];

  for (const email of notifyEmails) {
    tasks.push({
      kind: "admin",
      promise: sendEmail({
        to: email,
        subject: `Nova solicitação de vivências — ${data.numero} — ${data.school_nome}`,
        html: adminContent.html,
        text: adminContent.text,
      }),
    });
  }

  if (notifyEmails.length === 0) {
    const msg =
      "[vivencias-notify] Nenhum destinatário com alerta Vivências ativo (profile/RPC/env).";
    console.warn(msg);
    result.errors.push(msg);
  }

  if (solicitante) {
    tasks.push({
      kind: "solicitante",
      promise: sendEmail({
        to: solicitante,
        subject: `Solicitação de VIVÊNCIA registrada — Protocolo ${data.numero}`,
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
    console.error("[vivencias-notify] Falha ao enviar e-mail:", reason);
    result.errors.push(reason);
    result.ok = false;
  });

  console.info("[vivencias-notify] resultado", result);
  return result;
}
