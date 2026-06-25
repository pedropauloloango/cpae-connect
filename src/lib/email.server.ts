type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return { apiKey, from, appUrl, adminEmails };
}

export function isEmailConfigured(): boolean {
  const { apiKey, from } = getEmailConfig();
  return Boolean(apiKey && from);
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY ou EMAIL_FROM não configurados — e-mail não enviado.");
    return;
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${response.status}): ${body || response.statusText}`);
  }
}
