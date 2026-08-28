import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getClientIpFromRequest } from "@/lib/client-ip.server";
import { digitsOnly } from "@/lib/saude-mental-options";
import type { ConfirmPresencaResult } from "@/lib/saude-mental-presenca";

const confirmSchema = z.object({
  token: z.string().uuid("Link de presença inválido."),
  cpf: z.string().min(11, "Informe o CPF."),
});

function mapRpcRow(row: {
  ok?: boolean;
  mensagem?: string;
  nome_completo?: string | null;
  ja_registrado?: boolean;
}): ConfirmPresencaResult {
  return {
    ok: Boolean(row.ok),
    mensagem: String(row.mensagem ?? ""),
    nome_completo: (row.nome_completo as string | null) ?? null,
    ja_registrado: Boolean(row.ja_registrado),
  };
}

/** Confirma presença via QR no servidor, capturando o IP real do cliente. */
export const confirmarPresencaSaudeMentalQr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => confirmSchema.parse(d))
  .handler(async ({ data }): Promise<ConfirmPresencaResult> => {
    const request = getRequest();
    const clientIp = request ? getClientIpFromRequest(request) : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: result, error } = await supabaseAdmin.rpc("confirmar_presenca_saude_mental", {
      p_token: data.token,
      p_cpf: digitsOnly(data.cpf),
      p_client_ip: clientIp,
    });

    if (error) {
      const msg = error.message ?? "";
      if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
        throw new Error(
          "Função de presença não configurada. Execute scripts/add-saude-mental-presenca-ip.sql no Supabase.",
        );
      }
      throw new Error(msg || "Não foi possível processar a presença.");
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      return {
        ok: false,
        mensagem: "Resposta inválida do servidor.",
        nome_completo: null,
        ja_registrado: false,
      };
    }

    return mapRpcRow(row as Record<string, unknown>);
  });
