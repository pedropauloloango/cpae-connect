import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MENSAGEM_ENCERRADA =
  "As inscrições para o Curso de Saúde Mental na Educação estão encerradas no momento.";

export type SaudeMentalInscricaoStatus = {
  aberta: boolean;
  inscricoes_habilitadas: boolean;
  encerramento_em: string | null;
  mensagem_encerrada: string;
};

export type SaudeMentalInscricaoConfig = {
  id: number;
  inscricoes_habilitadas: boolean;
  encerramento_em: string | null;
  mensagem_encerrada: string;
  updated_at: string;
  updated_by: string | null;
};

function parseStatus(raw: unknown): SaudeMentalInscricaoStatus {
  const row = (raw ?? {}) as Record<string, unknown>;
  const encerramento = row.encerramento_em;
  return {
    aberta: row.aberta === true,
    inscricoes_habilitadas: row.inscricoes_habilitadas !== false,
    encerramento_em: typeof encerramento === "string" ? encerramento : null,
    mensagem_encerrada:
      typeof row.mensagem_encerrada === "string" && row.mensagem_encerrada.trim()
        ? row.mensagem_encerrada.trim()
        : DEFAULT_MENSAGEM_ENCERRADA,
  };
}

export function computeInscricaoAberta(config: {
  inscricoes_habilitadas: boolean;
  encerramento_em: string | null;
}): boolean {
  if (!config.inscricoes_habilitadas) return false;
  if (!config.encerramento_em) return true;
  return new Date(config.encerramento_em).getTime() > Date.now();
}

export async function fetchSaudeMentalInscricaoStatus(): Promise<SaudeMentalInscricaoStatus> {
  const { data, error } = await supabase.rpc("get_saude_mental_inscricao_status");
  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("Could not find the function")) {
      return {
        aberta: true,
        inscricoes_habilitadas: true,
        encerramento_em: null,
        mensagem_encerrada: DEFAULT_MENSAGEM_ENCERRADA,
      };
    }
    throw error;
  }
  return parseStatus(data);
}

export async function fetchSaudeMentalInscricaoConfig(): Promise<SaudeMentalInscricaoConfig> {
  const { data, error } = await supabase
    .from("saude_mental_inscricao_config")
    .select("id, inscricoes_habilitadas, encerramento_em, mensagem_encerrada, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("saude_mental_inscricao_config")) {
      throw new Error(
        "Configuração de inscrições não encontrada. Execute scripts/add-saude-mental-inscricao-config.sql no Supabase.",
      );
    }
    throw error;
  }

  if (!data) {
    throw new Error(
      "Configuração de inscrições não inicializada. Execute scripts/add-saude-mental-inscricao-config.sql no Supabase.",
    );
  }

  return {
    id: data.id,
    inscricoes_habilitadas: data.inscricoes_habilitadas,
    encerramento_em: data.encerramento_em,
    mensagem_encerrada: data.mensagem_encerrada?.trim() || DEFAULT_MENSAGEM_ENCERRADA,
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}

export type SaudeMentalInscricaoConfigUpdate = {
  inscricoes_habilitadas: boolean;
  encerramento_em: string | null;
  mensagem_encerrada: string;
};

export async function updateSaudeMentalInscricaoConfig(
  patch: SaudeMentalInscricaoConfigUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("saude_mental_inscricao_config")
    .update({
      inscricoes_habilitadas: patch.inscricoes_habilitadas,
      encerramento_em: patch.encerramento_em,
      mensagem_encerrada: patch.mensagem_encerrada.trim() || DEFAULT_MENSAGEM_ENCERRADA,
    })
    .eq("id", 1);

  if (error) throw error;
}

/** Converte ISO para valor de input datetime-local (hora local). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte datetime-local para ISO UTC (ou null se vazio). */
export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatEncerramentoBr(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function inscricaoFechadaMotivo(status: SaudeMentalInscricaoStatus): string | null {
  if (status.aberta) return null;
  if (!status.inscricoes_habilitadas) {
    return "Inscrições desabilitadas manualmente.";
  }
  if (status.encerramento_em && new Date(status.encerramento_em).getTime() <= Date.now()) {
    const quando = formatEncerramentoBr(status.encerramento_em);
    return quando ? `Prazo encerrado em ${quando}.` : "Prazo de inscrição encerrado.";
  }
  return "Inscrições encerradas.";
}
