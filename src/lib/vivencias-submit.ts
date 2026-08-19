import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  alunoSerieLabels,
  alunoTurmaLabels,
  solicitanteCargoLabels,
  type PeriodoEscolar,
  type SolicitanteCargo,
} from "./acolhimento-options";
import type { PalestraTema, VivenciaTema } from "./vivencias-options";
import { notifyVivenciaCreated } from "./vivencias-notify.functions";

export type VivenciaGroupSubmission = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: PeriodoEscolar;
  temas: VivenciaTema[];
  data_vivencia?: string | null;
  hora_inicio?: string | null;
};

export type VivenciaPalestraSubmission = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: PeriodoEscolar;
  palestra_tema: PalestraTema;
  data_preferivel?: string | null;
  hora_inicio?: string | null;
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
  palestras: VivenciaPalestraSubmission[];
  palestra_tema?: PalestraTema | null;
  data_preferivel_palestra?: string | null;
  hora_inicio_palestra?: string | null;
  serieLabels?: Record<string, string>;
  turmaLabels?: Record<string, string>;
};

function normalizePersonName(value: string): string {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function mapSubmitError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (error.code === "42804" || msg.includes("school_tipo") || msg.includes("expression is of type text")) {
    return "Função de envio desatualizada. Execute scripts/fix-submit-vivencia-tipo-escola.sql no Supabase.";
  }
  if (error.code === "PGRST204" || (msg.includes("column") && msg.includes("does not exist"))) {
    return "Banco de dados desatualizado. Execute scripts/fix-vivencias-module.sql no Supabase.";
  }
  if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
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
    const serieLabel =
      data.serieLabels?.[g.aluno_serie] ?? alunoSerieLabels[g.aluno_serie] ?? g.aluno_serie;
    const turmaLabel =
      data.turmaLabels?.[g.aluno_turma] ?? alunoTurmaLabels[g.aluno_turma] ?? g.aluno_turma;
    return {
      aluno_serie: serieLabel,
      aluno_turma: turmaLabel,
      periodo: g.periodo,
      temas: g.temas,
      data_preferivel: g.data_vivencia || null,
      hora_inicio: g.hora_inicio || null,
    };
  });

  const palestras = data.palestras.map((p) => {
    const serieLabel =
      data.serieLabels?.[p.aluno_serie] ?? alunoSerieLabels[p.aluno_serie] ?? p.aluno_serie;
    const turmaLabel =
      data.turmaLabels?.[p.aluno_turma] ?? alunoTurmaLabels[p.aluno_turma] ?? p.aluno_turma;
    return {
      aluno_serie: serieLabel,
      aluno_turma: turmaLabel,
      periodo: p.periodo,
      palestra_tema: p.palestra_tema,
      data_preferivel: p.data_preferivel || null,
      hora_inicio: p.hora_inicio || null,
    };
  });

  const primeiraPalestra = palestras[0] ?? null;

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
    palestras,
    // Compatibilidade com leituras legadas enquanto a app migra para múltiplas palestras:
    // espelhamos a primeira palestra nos campos antigos da requisição.
    palestra_tema: primeiraPalestra?.palestra_tema ?? (data.palestra_tema || null),
    data_preferivel_palestra: primeiraPalestra?.data_preferivel ?? (data.data_preferivel_palestra || null),
    hora_inicio_palestra: primeiraPalestra?.hora_inicio ?? (data.hora_inicio_palestra || null),
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

  const alertEmails = Array.isArray(req.alert_emails)
    ? req.alert_emails.filter((e: unknown): e is string => typeof e === "string" && e.includes("@"))
    : [];

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
      palestras,
      palestra_tema: primeiraPalestra?.palestra_tema ?? (data.palestra_tema || null),
      data_preferivel_palestra: primeiraPalestra?.data_preferivel ?? (data.data_preferivel_palestra || null),
      hora_inicio_palestra: primeiraPalestra?.hora_inicio ?? (data.hora_inicio_palestra || null),
      alertEmails,
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
