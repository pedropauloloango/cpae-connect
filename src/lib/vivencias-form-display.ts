import { schoolTipoLabels } from "@/lib/labels";
import {
  periodoLabels,
  regiaoEscolaLabel,
  solicitanteCargoLabels,
  alunoSerieLabels,
} from "@/lib/acolhimento-options";
import { palestraTemaLabel, vivenciaTemaLabel } from "@/lib/vivencias-options";

export type VivenciaFormAnswer = {
  number: number;
  question: string;
  answer: string;
};

export type VivenciaFormSection = {
  title: string;
  items: VivenciaFormAnswer[];
};

export type VivenciaGroupView = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[] | null;
  data_preferivel?: string | null;
};

type VivenciaRequestView = {
  school_nome_snapshot?: string | null;
  tipo_escola?: string | null;
  regiao_escola?: string | null;
  school?: { regiao?: string | null } | null;
  solicitante_email?: string | null;
  solicitante_nome?: string | null;
  solicitante_cargo?: string | null;
  solicitante_telefone?: string | null;
  palestra_tema?: string | null;
  data_preferivel_palestra?: string | null;
  groups?: VivenciaGroupView[] | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatSerie(value: string | null | undefined): string {
  if (!value) return "—";
  return alunoSerieLabels[value as keyof typeof alunoSerieLabels] ?? value;
}

export function buildVivenciaFormSections(req: VivenciaRequestView): VivenciaFormSection[] {
  const groups = req.groups ?? [];
  const sections: VivenciaFormSection[] = [
    {
      title: "Identificação",
      items: [
        { number: 1, question: "Nome da Escola / EMEI", answer: req.school_nome_snapshot ?? "—" },
        {
          number: 2,
          question: "Tipo Escola",
          answer: req.tipo_escola ? (schoolTipoLabels[req.tipo_escola] ?? req.tipo_escola) : "—",
        },
        {
          number: 3,
          question: "Região",
          answer: regiaoEscolaLabel(req.regiao_escola ?? req.school?.regiao),
        },
        { number: 4, question: "Nome do solicitante", answer: req.solicitante_nome ?? "—" },
        { number: 5, question: "E-mail", answer: req.solicitante_email ?? "—" },
        {
          number: 6,
          question: "Cargo",
          answer: req.solicitante_cargo
            ? (solicitanteCargoLabels[req.solicitante_cargo] ?? req.solicitante_cargo)
            : "—",
        },
        { number: 7, question: "Telefone", answer: req.solicitante_telefone ?? "—" },
      ],
    },
  ];

  if (groups.length) {
    sections.push({
      title: "Vivências para alunos",
      items: groups.flatMap((g, i) => [
        {
          number: 0,
          question: `Turma ${i + 1} — Série`,
          answer: formatSerie(g.aluno_serie),
        },
        {
          number: 0,
          question: `Turma ${i + 1} — Turma`,
          answer: g.aluno_turma || "—",
        },
        {
          number: 0,
          question: `Turma ${i + 1} — Período`,
          answer: periodoLabels[g.periodo] ?? g.periodo ?? "—",
        },
        {
          number: 0,
          question: `Turma ${i + 1} — Temas`,
          answer: g.temas?.length ? g.temas.map((t) => vivenciaTemaLabel(t)).join("; ") : "—",
        },
        {
          number: 0,
          question: `Turma ${i + 1} — Data preferível da Vivência`,
          answer: formatDate(g.data_preferivel),
        },
      ]),
    });
  }

  sections.push({
    title: "Palestras e datas",
    items: [
      { number: 0, question: "Palestra", answer: palestraTemaLabel(req.palestra_tema) },
      {
        number: 0,
        question: "Data preferível — Palestra",
        answer: formatDate(req.data_preferivel_palestra),
      },
    ],
  });

  return sections;
}
