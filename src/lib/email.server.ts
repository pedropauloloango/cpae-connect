type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: from.trim() };
}

export function getEmailConfig() {
  const apiToken = process.env.MAILERSEND_API_TOKEN?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return { apiToken, from, appUrl, adminEmails };
}

export function isEmailConfigured(): boolean {
  const { apiToken, from } = getEmailConfig();
  return Boolean(apiToken && from);
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { apiToken, from } = getEmailConfig();
  if (!apiToken || !from) {
    console.warn("[email] MAILERSEND_API_TOKEN ou EMAIL_FROM não configurados — e-mail não enviado.");
    return;
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;

  const fromParsed = parseFromAddress(from);

  const response = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: {
        email: fromParsed.email,
        ...(fromParsed.name ? { name: fromParsed.name } : {}),
      },
      to: recipients.map((email) => ({ email })),
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${response.status}): ${body || response.statusText}`);
  }
}
