import { supabase } from "@/integrations/supabase/client";
import { fetchPublicSchools, type PublicSchoolOption } from "@/lib/schools-public.functions";

export type { PublicSchoolOption };

function isBrowserNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const lower = msg.toLowerCase();
  return (
    (error instanceof TypeError && lower.includes("fetch")) ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed") ||
    lower.includes("err_name_not_resolved") ||
    lower.includes("err_connection")
  );
}

async function fetchSchoolsFromBrowser(): Promise<PublicSchoolOption[]> {
  const { data, error } = await supabase
    .from("schools")
    .select("id, nome, regiao, tipo_escola")
    .is("deleted_at", null)
    .eq("status", "ativa")
    .order("nome");

  if (error) {
    if (isBrowserNetworkError(error)) throw error;
    throw new Error(error.message || "Erro ao buscar escolas");
  }
  return (data ?? []) as PublicSchoolOption[];
}

/**
 * Carrega escolas para o formulário público.
 * Preferência pelo browser (evita SSL corporativo no Node); servidor como fallback.
 */
export async function loadPublicSchools(): Promise<PublicSchoolOption[]> {
  try {
    return await fetchSchoolsFromBrowser();
  } catch (clientError) {
    if (!isBrowserNetworkError(clientError)) throw clientError;

    try {
      return await fetchPublicSchools();
    } catch {
      throw clientError;
    }
  }
}

export function publicSchoolsErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Não foi possível carregar as escolas.";

  const msg = error.message.toLowerCase();
  if (msg.includes("err_name_not_resolved") || msg.includes("failed to fetch")) {
    return "Sem conexão com o servidor. Verifique sua internet ou tente outra rede.";
  }
  if (msg.includes("jwt") || msg.includes("apikey") || msg.includes("401")) {
    return "Configuração do Supabase inválida. Verifique as chaves no arquivo .env.";
  }
  if (msg.includes("tipo_escola") || msg.includes("column") || msg.includes("pgrst")) {
    return "Banco de dados desatualizado. Execute as migrações SQL no Supabase.";
  }

  return error.message || "Não foi possível carregar as escolas.";
}
