import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

/**
 * Gera senha temporária, atualiza no Auth e envia ao e-mail cadastrado.
 * Resposta genérica (não revela se o e-mail existe).
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email("Informe um e-mail válido."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const genericOk = {
      ok: true as const,
      message:
        "Se este e-mail estiver cadastrado, você receberá uma nova senha temporária em instantes.",
    };

    try {
      if (!isEmailConfigured()) {
        throw new Error(
          "Envio de e-mail não configurado no servidor. Contate a administração.",
        );
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("requestPasswordReset profile", profileError);
        return genericOk;
      }
      if (!profile?.id) return genericOk;

      const temporaryPassword = generateTemporaryPassword(10);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: temporaryPassword,
      });
      if (updateError) {
        console.error("requestPasswordReset updateUser", updateError);
        throw new Error(
          "Não foi possível redefinir a senha deste usuário. Contate a administração.",
        );
      }

      const { error: flagError } = await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", profile.id);
      if (flagError) {
        console.error("requestPasswordReset must_change_password", flagError);
      }

      const { appUrl } = getEmailConfig();
      const loginUrl = appUrl ? `${appUrl}/auth` : "";
      const displayName = profile.full_name?.trim() || "usuário";

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
            Se você não solicitou esta redefinição, ignore este e-mail e contate a administração.
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
        "Use esta senha para entrar. Se não solicitou, ignore este e-mail.",
        loginUrl ? `Acesso: ${loginUrl}` : "",
        buildEmailSignatureText(),
      ]
        .filter(Boolean)
        .join("\n");

      await sendEmail({
        to: email,
        subject: "Nova senha temporária — Gestão CPAE",
        html,
        text,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Envio de e-mail não configurado")) throw err;
      if (message.includes("Não foi possível redefinir")) throw err;
      if (message.includes("Falha ao enviar e-mail")) throw err;
      console.error("requestPasswordReset", err);
    }

    return genericOk;
  });
