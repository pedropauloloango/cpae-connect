import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SaudeMentalSubmission = {
  school_id: string;
  school_nome: string;
  escola_texto?: string | null;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  telefone_whatsapp: string;
  email: string;
  email_formulario?: string | null;
  funcao: string;
  nivel_escolaridade: string;
};

function mapSubmitError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
    return "Função de inscrição não configurada. Execute a migration do módulo Saúde Mental no Supabase.";
  }
  if (msg.includes("row-level security") || error.code === "42501") {
    return "Permissão negada ao registrar inscrição. Verifique as policies no Supabase.";
  }
  return msg || "Não foi possível registrar a inscrição. Tente novamente.";
}

export async function submitSaudeMentalInscricao(
  data: SaudeMentalSubmission,
): Promise<{ numero: string; id: string }> {
  const payload = {
    school_id: data.school_id,
    school_nome: data.school_nome.trim(),
    escola_texto: data.escola_texto?.trim() || data.school_nome.trim(),
    nome_completo: data.nome_completo.trim(),
    cpf: data.cpf.trim(),
    data_nascimento: data.data_nascimento,
    telefone_whatsapp: data.telefone_whatsapp.trim(),
    email: data.email.trim().toLowerCase(),
    email_formulario: data.email_formulario?.trim().toLowerCase() || data.email.trim().toLowerCase(),
    funcao: data.funcao.trim(),
    nivel_escolaridade: data.nivel_escolaridade.trim(),
    origem: "formulario",
    ano_curso: new Date().getFullYear(),
  };

  const { data: result, error } = await supabase.rpc("submit_saude_mental_inscricao", {
    payload: payload as unknown as Json,
  });

  if (error) throw new Error(mapSubmitError(error));

  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.id || !row?.numero) {
    throw new Error("Resposta inválida do servidor ao registrar inscrição.");
  }
  return { id: row.id as string, numero: row.numero as string };
}
