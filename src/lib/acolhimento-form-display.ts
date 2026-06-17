import { schoolTipoLabels } from "@/lib/labels";
import {
  alunoSexoLabels,
  alunoTurmaLabels,
  autorizacaoAtaLabels,
  comunicouAbusoLabels,
  modalidadeLabels,
  periodoLabels,
  regiaoEscolaLabel,
  situacaoObservadaLabels,
  solicitanteCargoLabels,
} from "@/lib/acolhimento-options";

export type AcolhimentoFormAnswer = {
  number: number;
  question: string;
  answer: string;
};

export type AcolhimentoFormSection = {
  title: string;
  items: AcolhimentoFormAnswer[];
};

type RequestFormData = {
  school_nome_snapshot?: string | null;
  tipo_escola?: string | null;
  regiao_escola?: string | null;
  school?: { regiao?: string | null } | null;
  solicitante_email?: string | null;
  solicitante_nome?: string | null;
  solicitante_cargo?: string | null;
  solicitante_nome_cargo?: string | null;
  solicitante_telefone?: string | null;
  diretor_responsavel?: string | null;
  diretor_telefone?: string | null;
  modalidade_acolhimento?: string | null;
  aluno_nome?: string | null;
  aluno_nascimento?: string | null;
  aluno_sexo?: string | null;
  educacao_especial?: boolean | null;
  aluno_serie?: string | null;
  aluno_turma?: string | null;
  aluno_turma_ano?: string | null;
  periodo?: string | null;
  comunicou_abuso?: string[] | null;
  situacao_observada?: string[] | null;
  acolhido_anteriormente?: boolean | null;
  autorizacao_ata?: string | null;
  descricao?: string | null;
};

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Sim" : "Não";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatList(items: string[] | null | undefined, labels: Record<string, string>): string {
  if (!items?.length) return "—";
  return items.map((i) => labels[i] ?? i).join("; ");
}

function solicitanteNome(req: RequestFormData): string {
  return req.solicitante_nome ?? req.solicitante_nome_cargo?.split(" — ")[0] ?? req.diretor_responsavel ?? "—";
}

function solicitanteCargo(req: RequestFormData): string {
  if (req.solicitante_cargo) {
    return solicitanteCargoLabels[req.solicitante_cargo] ?? req.solicitante_cargo;
  }
  if (req.solicitante_nome_cargo?.includes(" — ")) {
    return req.solicitante_nome_cargo.split(" — ").slice(1).join(" — ");
  }
  return "—";
}

function regiao(req: RequestFormData): string {
  if (req.regiao_escola) return regiaoEscolaLabel(req.regiao_escola);
  if (req.school?.regiao) return regiaoEscolaLabel(req.school.regiao);
  return "—";
}

function serie(req: RequestFormData): string {
  if (req.aluno_serie) return req.aluno_serie;
  if (req.aluno_turma_ano) return req.aluno_turma_ano.replace(/\s+[A-E]$/i, "").trim() || req.aluno_turma_ano;
  return "—";
}

function turma(req: RequestFormData): string {
  if (req.aluno_turma) return alunoTurmaLabels[req.aluno_turma] ?? req.aluno_turma;
  const match = req.aluno_turma_ano?.match(/\s([A-E])$/i);
  return match ? match[1].toUpperCase() : "—";
}

/** Monta perguntas e respostas do formulário público para exibição na demanda. */
export function buildAcolhimentoFormSections(req: RequestFormData): AcolhimentoFormSection[] {
  const sections: AcolhimentoFormSection[] = [
    {
      title: "Identificação",
      items: [
        { number: 1, question: "Nome da Escola / EMEI", answer: req.school_nome_snapshot ?? "—" },
        {
          number: 2,
          question: "Tipo Escola",
          answer: req.tipo_escola ? schoolTipoLabels[req.tipo_escola] ?? req.tipo_escola : "—",
        },
        { number: 3, question: "Região onde a Escola / EMEI está localizada", answer: regiao(req) },
        { number: 4, question: "Nome completo do solicitante", answer: solicitanteNome(req) },
        { number: 5, question: "E-mail", answer: req.solicitante_email ?? "—" },
        { number: 6, question: "Cargo do(a) Solicitante", answer: solicitanteCargo(req) },
        { number: 7, question: "Telefone para contato", answer: req.solicitante_telefone ?? req.diretor_telefone ?? "—" },
      ],
    },
    {
      title: "Acolhimento",
      items: [
        {
          number: 8,
          question: "Modalidade do acolhimento",
          answer: req.modalidade_acolhimento ? modalidadeLabels[req.modalidade_acolhimento] ?? req.modalidade_acolhimento : "—",
        },
      ],
    },
    {
      title: "Dados do(a) aluno(a)",
      items: [
        { number: 9, question: "Nome do(a) aluno(a)", answer: req.aluno_nome ?? "—" },
        { number: 10, question: "Data de Nascimento", answer: formatDate(req.aluno_nascimento) },
        {
          number: 11,
          question: "Sexo",
          answer: req.aluno_sexo ? alunoSexoLabels[req.aluno_sexo] ?? req.aluno_sexo : "—",
        },
        { number: 12, question: "O(a) estudante é público-alvo da Educação Especial", answer: yesNo(req.educacao_especial) },
        { number: 13, question: "Série", answer: serie(req) },
        { number: 14, question: "Turma", answer: turma(req) },
        {
          number: 15,
          question: "Período",
          answer: req.periodo ? periodoLabels[req.periodo] ?? req.periodo : "—",
        },
      ],
    },
    {
      title: "Situação e comunicações",
      items: [
        {
          number: 16,
          question: "Em caso de abuso ou outras negligências, a Escola comunicou",
          answer: formatList(req.comunicou_abuso, comunicouAbusoLabels),
        },
        {
          number: 17,
          question: "Situação observada",
          answer: formatList(req.situacao_observada, situacaoObservadaLabels),
        },
        {
          number: 18,
          question: "O(a) aluno(a) já foi acolhido pela CPAE anteriormente?",
          answer: yesNo(req.acolhido_anteriormente),
        },
        {
          number: 19,
          question: "A escola tem autorização do(a) responsável em ata para a realização do acolhimento?",
          answer: req.autorizacao_ata ? autorizacaoAtaLabels[req.autorizacao_ata] ?? req.autorizacao_ata : "—",
        },
      ],
    },
  ];

  if (req.descricao?.trim()) {
    sections[sections.length - 1].items.push({
      number: 20,
      question: "Observações adicionais",
      answer: req.descricao.trim(),
    });
  }

  return sections;
}

/** Linhas do grid por seção — espelha o layout do formulário /acolhimento. */
export function getSectionLayoutRows(section: AcolhimentoFormSection): number[][] {
  const nums = new Set(section.items.map((i) => i.number));
  const has = (n: number) => nums.has(n);
  const row = (...ns: number[]) => ns.filter(has);
  const rows = (() => {
    switch (section.title) {
      case "Identificação":
        return [row(1, 2, 3), row(4, 5, 6, 7)];
      case "Acolhimento":
        return [row(8)];
      case "Dados do(a) aluno(a)":
        return [row(9, 10, 11), row(12, 13, 14, 15)];
      case "Situação e comunicações":
        return [row(16), row(17), row(18), row(19), row(20)];
      default:
        return section.items.map((i) => [i.number]);
    }
  })();
  return rows.filter((r) => r.length > 0);
}
