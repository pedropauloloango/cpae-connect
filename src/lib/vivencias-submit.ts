import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  alunoSerieLabels,
  solicitanteCargoLabels,
  type AlunoSerie,
  type AlunoTurma,
  type PeriodoEscolar,
  type SolicitanteCargo,
} from "./acolhimento-options";
import type { PalestraTema, VivenciaTema } from "./vivencias-options";
import { notifyVivenciaCreated } from "./vivencias-notify.functions";

export type VivenciaGroupSubmission = {
  aluno_serie: AlunoSerie;
  aluno_turma: AlunoTurma;
  periodo: PeriodoEscolar;
  temas: VivenciaTema[];
  data_vivencia?: string | null;
};

export type VivenciaSubmission = {
  school_id: string;
  school_nome: string;
  tipo_escola: "escola" | "emei";
  regiao_escola: string | null;
  solicitante_email: string;
  solicitante_nome: string;
  solicitante_cargo: SolicitanteCargo;
  solicitante_telefone: string;
  groups: VivenciaGroupSubmission[];
  palestra_tema?: PalestraTema | null;
  data_preferivel_palestra?: string | null;
};

function normalizePersonName(value: string): string {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function mapSubmitError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("column") || error.code === "PGRST204") {
    return "Banco de dados desatualizado. Execute scripts/fix-vivencias-module.sql no Supabase.";
  }
  if (error.code === "PGRST202" || msg.includes("submit_vivencia_request")) {
    return "Função de envio não configurada. Execute scripts/fix-vivencias-module.sql no Supabase.";
  }
  if (msg.includes("row-level security") || error.code === "42501") {
    return "Permissão negada. Execute scripts/fix-vivencias-module.sql no Supabase.";
  }
  return msg || "Não foi possível registrar a solicitação. Tente novamente.";
}

export async function submitVivenciaRequest(
  data: VivenciaSubmission,
): Promise<{ numero: string; id: string }> {
  const solicitanteNome = normalizePersonName(data.solicitante_nome);

  const groups = data.groups.map((g) => {
    const serieLabel = alunoSerieLabels[g.aluno_serie] ?? g.aluno_serie;
    return {
      aluno_serie: serieLabel,
      aluno_turma: g.aluno_turma,
      periodo: g.periodo,
      temas: g.temas,
      data_preferivel: g.data_vivencia || null,
    };
  });

  const payload: Json = {
    school_id: data.school_id,
    school_nome: data.school_nome.trim(),
    tipo_escola: data.tipo_escola,
    regiao_escola: data.regiao_escola || null,
    solicitante_email: data.solicitante_email.trim(),
    solicitante_nome: solicitanteNome,
    solicitante_cargo: data.solicitante_cargo,
    solicitante_telefone: data.solicitante_telefone.trim(),
    groups,
    palestra_tema: data.palestra_tema || null,
    data_preferivel_palestra: data.data_preferivel_palestra || null,
  };

  const { data: rows, error } = await supabase.rpc("submit_vivencia_request", { payload });

  if (error) {
    console.error("submitVivenciaRequest error", error);
    throw new Error(mapSubmitError(error));
  }

  const req = Array.isArray(rows) ? rows[0] : rows;
  if (!req?.numero || !req?.id) {
    throw new Error("Não foi possível registrar a solicitação. Tente novamente.");
  }

  // E-mail em background: não atrasa o protocolo
  void notifyVivenciaCreated({
    data: {
      requestId: req.id,
      numero: req.numero,
      school_nome: data.school_nome.trim(),
      tipo_escola: data.tipo_escola,
      regiao_escola: data.regiao_escola || null,
      solicitante_email: data.solicitante_email.trim(),
      solicitante_nome: solicitanteNome,
      solicitante_cargo: data.solicitante_cargo,
      solicitante_telefone: data.solicitante_telefone.trim(),
      groups,
      palestra_tema: data.palestra_tema || null,
      data_preferivel_palestra: data.data_preferivel_palestra || null,
    },
  })
    .then((notifyResult) => {
      console.info("notifyVivenciaCreated result", notifyResult);
    })
    .catch((err) => {
      console.error("notifyVivenciaCreated error", err);
    });

  return { numero: req.numero, id: req.id };
}

export { solicitanteCargoLabels };
