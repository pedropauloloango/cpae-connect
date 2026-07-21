import { createServerFn } from "@tanstack/react-start";

/**
 * Verifica se o provedor Google está habilitado no projeto Supabase.
 * Evita redirecionar o usuário para uma página em branco quando o OAuth não está configurado.
 */
export const checkGoogleAuthEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      enabled: false as const,
      message: "Configuração do Supabase incompleta no servidor.",
    };
  }

  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", `${supabaseUrl}/`);

  const response = await fetch(authorizeUrl, {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (response.status >= 300 && response.status < 400) {
    return { enabled: true as const };
  }

  let message = "Login com Google não está habilitado no Supabase.";
  try {
    const body = (await response.json()) as { msg?: string; message?: string };
    message = body.msg || body.message || message;
  } catch {
    // ignore JSON parse errors
  }

  return { enabled: false as const, message };
});
