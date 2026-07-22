import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  alunoSerieLabels,
  deriveTipoQueixa,
  solicitanteCargoLabels,
  type AutorizacaoAta,
  type ComunicouAbuso,
  type ModalidadeAcolhimento,
  type PeriodoEscolar,
  type SituacaoObservada,
  type SolicitanteCargo,
  type AlunoSerie,
  type AlunoSexo,
  type AlunoTurma,
} from "./acolhimento-options";
import { notifyAcolhimentoCreated } from "./acolhimento-notify.functions";

type ComplaintType = Database["public"]["Enums"]["complaint_type"];

export function normalizeAcolhimentoPersonName(value: string): string {
  return value.trim().toLocaleUpperCase("pt-BR");
}

export type AcolhimentoSubmission = {
  school_id: string;
  school_nome: string;
  tipo_escola: "escola" | "emei";
  regiao_escola: string | null;
  solicitante_email: string;
  solicitante_nome: string;
  solicitante_cargo: SolicitanteCargo;
  solicitante_telefone: string;
  modalidade_acolhimento: ModalidadeAcolhimento;
  aluno_nome: string;
  aluno_nascimento: string;
  aluno_sexo: AlunoSexo;
  educacao_especial: "sim" | "nao";
  aluno_serie: AlunoSerie;
  aluno_turma: AlunoTurma;
  periodo: PeriodoEscolar;
  comunicou_abuso: ComunicouAbuso[];
  situacao_observada: SituacaoObservada[];
  acolhido_anteriormente: "sim" | "nao";
  autorizacao_ata: AutorizacaoAta;
};

function mapSubmitError(error: { message?: string; code?: string; hint?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("column") || error.code === "PGRST204") {
    return "Banco de dados desatualizado. Execute os scripts SQL de migração no Supabase e tente novamente.";
  }
  if (error.code === "PGRST202" || msg.includes("submit_acolhimento_request")) {
    return "Função de envio não configurada. Execute scripts/fix-acolhimento-public-submit.sql no Supabase.";
  }
  if (msg.includes("row-level security") || error.code === "42501") {
    return "Permissão negada. Execute scripts/fix-acolhimento-public-submit.sql no Supabase.";
  }
  return msg || "Não foi possível registrar a solicitação. Tente novamente.";
}

/** Envia solicitação via RPC no Supabase (browser). Evita server function + SSL corporativo no Node. */
export async function submitAcolhimentoRequest(
  data: AcolhimentoSubmission,
): Promise<{ numero: string; id: string }> {
  const tipo_queixa = deriveTipoQueixa(data.situacao_observada) as ComplaintType;
  const cargoLabel = solicitanteCargoLabels[data.solicitante_cargo] ?? data.solicitante_cargo;
  const solicitanteNome = normalizeAcolhimentoPersonName(data.solicitante_nome);
  const alunoNome = normalizeAcolhimentoPersonName(data.aluno_nome);
  const nomeCargo = `${solicitanteNome} — ${cargoLabel}`;
  const serieLabel = alunoSerieLabels[data.aluno_serie] ?? `${data.aluno_serie}º ano`;
  const turmaAno = `${serieLabel} ${data.aluno_turma}`;

  const payload: Json = {
    school_id: data.school_id,
    school_nome: data.school_nome.trim(),
    tipo_escola: data.tipo_escola,
    regiao_escola: data.regiao_escola || null,
    solicitante_email: data.solicitante_email.trim(),
    solicitante_nome: solicitanteNome,
    solicitante_cargo: data.solicitante_cargo,
    solicitante_nome_cargo: nomeCargo,
    solicitante_telefone: data.solicitante_telefone.trim(),
    modalidade_acolhimento: data.modalidade_acolhimento,
    aluno_nome: alunoNome,
    aluno_nascimento: data.aluno_nascimento,
    aluno_sexo: data.aluno_sexo,
    educacao_especial: data.educacao_especial === "sim",
    aluno_serie: serieLabel,
    aluno_turma: data.aluno_turma,
    aluno_turma_ano: turmaAno,
    periodo: data.periodo,
    comunicou_abuso: data.comunicou_abuso,
    situacao_observada: data.situacao_observada,
    acolhido_anteriormente: data.acolhido_anteriormente === "sim",
    autorizacao_ata: data.autorizacao_ata,
    tipo_queixa,
    descricao: "",
  };

  const { data: rows, error } = await supabase.rpc("submit_acolhimento_request", { payload });

  if (error) {
    console.error("submitAcolhimentoRequest error", error);
    throw new Error(mapSubmitError(error));
  }

  const req = Array.isArray(rows) ? rows[0] : rows;
  if (!req?.numero || !req?.id) {
    throw new Error("Não foi possível registrar a solicitação. Tente novamente.");
  }

  try {
    await notifyAcolhimentoCreated({
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
        modalidade_acolhimento: data.modalidade_acolhimento,
        aluno_nome: alunoNome,
        aluno_nascimento: data.aluno_nascimento,
        aluno_sexo: data.aluno_sexo,
        educacao_especial: data.educacao_especial === "sim",
        aluno_serie: serieLabel,
        aluno_turma: data.aluno_turma,
        aluno_turma_ano: turmaAno,
        periodo: data.periodo,
        comunicou_abuso: data.comunicou_abuso,
        situacao_observada: data.situacao_observada,
        acolhido_anteriormente: data.acolhido_anteriormente === "sim",
        autorizacao_ata: data.autorizacao_ata,
        tipo_queixa,
      },
    });
  } catch (err) {
    console.error("notifyAcolhimentoCreated error", err);
  }

  return { numero: req.numero, id: req.id };
}
