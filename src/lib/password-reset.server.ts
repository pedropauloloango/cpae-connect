import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEmailConfig, isEmailConfigured, sendEmail } from "@/lib/email.server";
import { buildEmailSignatureHtml, buildEmailSignatureText } from "@/lib/email-signature";

function generateTemporaryPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PasswordResetTarget = {
  id: string;
  email: string;
  fullName: string | null;
};

/**
 * Gera senha temporária, grava no Auth, marca troca obrigatória e envia ao e-mail do usuário.
 */
export async function sendTemporaryPassword(target: PasswordResetTarget): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Envio de e-mail não configurado no servidor. Contate a administração.");
  }

  const temporaryPassword = generateTemporaryPassword(10);

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    password: temporaryPassword,
  });
  if (updateError) {
    console.error("sendTemporaryPassword updateUser", updateError);
    throw new Error("Não foi possível redefinir a senha deste usuário. Contate a administração.");
  }

  const { error: flagError } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", target.id);
  if (flagError) {
    console.error("sendTemporaryPassword must_change_password", flagError);
  }

  const { appUrl } = getEmailConfig();
  const loginUrl = appUrl ? `${appUrl}/auth` : "";
  const displayName = target.fullName?.trim() || "usuário";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 12px;font-size:20px;">Redefinição de senha — Gestão CPAE</h2>
      <p style="margin:0 0 12px;line-height:1.5;">Olá, ${escapeHtml(displayName)}.</p>
      <p style="margin:0 0 12px;line-height:1.5;">
        Recebemos um pedido para redefinir a senha da sua conta.
        Use a senha temporária abaixo para entrar:
      </p>
      <p style="margin:16px 0;padding:14px 16px;background:#f1f5f9;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:0.04em;text-align:center;">
        ${escapeHtml(temporaryPassword)}
      </p>
      <p style="margin:0 0 12px;line-height:1.5;color:#475569;font-size:14px;">
        No primeiro acesso com esta senha, o sistema pedirá que você defina uma nova senha.
        Se você não solicitou esta redefinição, contate a administração.
      </p>
      ${
        loginUrl
          ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:10px 16px;background:#0F52BA;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Acessar o sistema</a></p>`
          : ""
      }
      ${buildEmailSignatureHtml(appUrl)}
    </div>
  `.trim();

  const text = [
    `Olá, ${displayName}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta Gestão CPAE.",
    `Senha temporária: ${temporaryPassword}`,
    "",
    "Use esta senha para entrar. No primeiro acesso, defina uma nova senha.",
    loginUrl ? `Acesso: ${loginUrl}` : "",
    buildEmailSignatureText(),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmail({
      to: target.email,
      subject: "Nova senha temporária — Gestão CPAE",
      html,
      text,
    });
  } catch (err) {
    console.error("sendTemporaryPassword sendEmail", err);
    throw new Error(
      "A senha não pôde ser enviada por e-mail (falha no servidor de e-mail). Contate a administração.",
    );
  }
}
