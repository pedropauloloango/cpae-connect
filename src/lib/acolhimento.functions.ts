import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deriveTipoQueixa, alunoSerieLabels, alunoSerieValues, alunoTurmaValues, solicitanteCargoLabels, solicitanteCargoValues } from "./acolhimento-options";
import { sendAcolhimentoCreatedEmails } from "./acolhimento-notify.server";
import { normalizeAcolhimentoPersonName } from "./acolhimento-submit";
import type { Database } from "@/integrations/supabase/types";

type ComplaintType = Database["public"]["Enums"]["complaint_type"];

const submissionSchema = z.object({
  solicitante_email: z.string().email("Informe um e-mail válido"),
  school_id: z.string().uuid("Selecione a escola ou EMEI"),
  school_nome: z.string().min(2, "Informe o nome da escola").max(200),
  tipo_escola: z.enum(["escola", "emei"]),
  regiao_escola: z.string().max(50).optional().nullable(),
  solicitante_nome: z.string().min(2, "Informe o nome completo").max(200),
  solicitante_cargo: z.enum(solicitanteCargoValues),
  solicitante_telefone: z.string().min(8, "Informe o telefone").max(50),
  modalidade_acolhimento: z.enum(["presencial", "online"]),
  aluno_nome: z.string().min(2, "Informe o nome do aluno").max(200),
  aluno_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento"),
  aluno_sexo: z.enum(["masculino", "feminino", "outro"]),
  educacao_especial: z.enum(["sim", "nao"]),
  aluno_serie: z.enum(alunoSerieValues),
  aluno_turma: z.enum(alunoTurmaValues),
  periodo: z.enum(["matutino", "vespertino", "integral", "noturno"]),
  comunicou_abuso: z
    .array(z.enum(["conselho_tutelar", "orgao_semed", "nao_se_aplica", "outra_rede", "outro"]))
    .min(1, "Selecione ao menos uma opção"),
  situacao_observada: z
    .array(z.enum(["autolesao", "ideacao_suicida", "ansiedade_depressao", "bullying", "luto", "outro"]))
    .min(1, "Selecione ao menos uma situação"),
  acolhido_anteriormente: z.enum(["sim", "nao"]),
  autorizacao_ata: z.enum(["ja_temos", "ainda_nao"]),
});

export const submitAcolhimento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submissionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tipo_queixa = deriveTipoQueixa(data.situacao_observada) as ComplaintType;

    const cargoLabel = solicitanteCargoLabels[data.solicitante_cargo] ?? data.solicitante_cargo;
    const solicitanteNome = normalizeAcolhimentoPersonName(data.solicitante_nome);
    const alunoNome = normalizeAcolhimentoPersonName(data.aluno_nome);
    const nomeCargo = `${solicitanteNome} — ${cargoLabel}`;
    const serieLabel = alunoSerieLabels[data.aluno_serie] ?? `${data.aluno_serie}º ano`;
    const turmaAno = `${serieLabel} ${data.aluno_turma}`;

    const { data: req, error } = await supabaseAdmin
      .from("requests")
      .insert({
        school_id: data.school_id,
        school_nome_snapshot: data.school_nome.trim(),
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
        status: "recebida",
      })
      .select("id, numero")
      .single();

    if (error || !req) {
      console.error("submitAcolhimento insert error", error);
      throw new Error("Não foi possível registrar a solicitação. Tente novamente.");
    }

    await supabaseAdmin.from("activity_logs").insert({
      request_id: req.id,
      actor_label: "Formulário público",
      action: "solicitacao_criada",
      details: { numero: req.numero, situacao_observada: data.situacao_observada },
    });

    try {
      await sendAcolhimentoCreatedEmails({
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
      });
    } catch (emailError) {
      console.error("sendAcolhimentoCreatedEmails error", emailError);
    }

    return { numero: req.numero, id: req.id };
  });
