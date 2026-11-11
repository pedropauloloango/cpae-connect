import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Gera senha temporária, atualiza no Auth e envia ao e-mail cadastrado.
 * Resposta genérica quando o e-mail não existe (não revela cadastros).
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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendTemporaryPassword } = await import("@/lib/password-reset.server");

      const emailPattern = email.replace(/[\\%_]/g, "\\$&");
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", emailPattern)
        .order("created_at", { ascending: true })
        .limit(1);

      if (profileError) {
        console.error("requestPasswordReset profile", profileError);
        throw new Error(
          "Não foi possível consultar o cadastro agora. Tente novamente ou contate a administração.",
        );
      }
      const profile = profiles?.[0];
      if (!profile?.id) {
        console.warn("requestPasswordReset: e-mail sem perfil", email);
        return genericOk;
      }

      await sendTemporaryPassword({ id: profile.id, email, fullName: profile.full_name });
    } catch (err) {
      console.error("requestPasswordReset", err);
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Envio de e-mail não configurado") ||
        message.includes("Não foi possível redefinir") ||
        message.includes("Não foi possível consultar") ||
        message.includes("A senha não pôde ser enviada")
      ) {
        throw err;
      }
      throw new Error("Não foi possível redefinir a senha agora. Contate a administração.");
    }

    return genericOk;
  });
