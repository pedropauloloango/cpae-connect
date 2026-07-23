import nodemailer from "nodemailer";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseFromAddress(from: string): { email: string; name?: string } {
  const cleaned = stripEnvQuotes(from);
  const match = cleaned.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: cleaned.trim() };
}

export function getEmailConfig() {
  const user = stripEnvQuotes(process.env.GMAIL_USER ?? "");
  // Aceita espaços na senha de app (Google mostra como "xxxx xxxx xxxx xxxx")
  const pass = stripEnvQuotes(process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  const from = stripEnvQuotes(process.env.EMAIL_FROM ?? "");
  const appUrl = stripEnvQuotes(process.env.APP_URL ?? "").replace(/\/$/, "");

  return { user, pass, from, appUrl };
}

export function isEmailConfigured(): boolean {
  const { user, pass, from } = getEmailConfig();
  return Boolean(user && pass && from);
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { user, pass, from } = getEmailConfig();
  if (!user || !pass || !from) {
    console.warn(
      "[email] GMAIL_USER, GMAIL_APP_PASSWORD ou EMAIL_FROM não configurados — e-mail não enviado.",
    );
    return;
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;

  const fromParsed = parseFromAddress(from);
  if (!fromParsed.email.includes("@")) {
    throw new Error(`[email] EMAIL_FROM inválido: ${from}`);
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: fromParsed.name
        ? { name: fromParsed.name, address: fromParsed.email }
        : fromParsed.email,
      to: recipients,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao enviar e-mail via Gmail SMTP: ${message}`);
  } finally {
    transporter.close();
  }
}
