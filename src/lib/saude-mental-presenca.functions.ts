import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getClientIp, getClientIpFromRequest } from "@/lib/client-ip.server";
import { digitsOnly } from "@/lib/saude-mental-options";

const presencaQrSchema = z.object({
  token: z.string().uuid("Link de presença inválido."),
  cpf: z.string().min(11, "Informe o CPF."),
});

/** Grava o IP real do respondente em presença já confirmada via QR. */
export const registrarIpPresencaSaudeMentalQr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => presencaQrSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const request = getRequest();
    const clientIp = getClientIp() ?? (request ? getClientIpFromRequest(request) : null);
    if (!clientIp) {
      return { ok: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await supabaseAdmin.rpc("atualizar_presenca_ip_saude_mental", {
      p_token: data.token,
      p_cpf: digitsOnly(data.cpf),
      p_client_ip: clientIp,
    });

    if (error) {
      const msg = error.message ?? "";
      if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
        throw new Error(
          "Função de IP de presença não configurada. Execute scripts/add-saude-mental-presenca-atualizar-ip.sql no Supabase.",
        );
      }
      throw new Error(msg || "Não foi possível registrar o IP da presença.");
    }

    return { ok: Boolean(updated) };
  });
