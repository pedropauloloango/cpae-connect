import {
  alunoSerieOptions,
  alunoTurmaOptions,
  periodoOptions,
  solicitanteCargoOptions,
  type AlunoSerie,
  type AlunoTurma,
  type PeriodoEscolar,
  type SolicitanteCargo,
} from "./acolhimento-options";

export { alunoSerieOptions, alunoTurmaOptions, periodoOptions, solicitanteCargoOptions };
export type { AlunoSerie, AlunoTurma, PeriodoEscolar, SolicitanteCargo };

export const vivenciaTemaOptions = [
  {
    value: "bullying_cyber_5_9",
    label: "Bullying / Cyberbullying: responsabilizações legais (5º ao 9º)",
  },
  {
    value: "bullying_grupos_4",
    label: "Bullying (Grupos ao 4º ano)",
  },
  {
    value: "telas_5_9",
    label: "Consequências do uso e abuso de telas (5º ao 9º)",
  },
  {
    value: "socioemocional_grupos_4",
    label: "Habilidades socioemocionais (Grupos ao 4º ano)",
  },
  {
    value: "relacionamento_grupos_4",
    label: "Relacionamento/Respeito e Tolerância, Regras e combinados (Grupos ao 4º ano)",
  },
  {
    value: "identidade_grupos_4",
    label: "Identidade e autoconhecimento (grupos ao 4º ano)",
  },
  {
    value: "proposito_5_9",
    label: "Propósito de vida e escolha profissional (5º ao 9º ano)",
  },
  {
    value: "setembro_amarelo_5_9",
    label: "Prevenção Setembro Amarelo (5º ao 9º ano)",
  },
  {
    value: "doce_encanto",
    label: "Projeto: Doce Encanto (Grupos e 1º ano)",
  },
] as const;

export const palestraTemaOptions = [
  {
    value: "familia_presente",
    label: "Família presente, filhos bem sucedidos (pais e responsáveis)",
  },
  {
    value: "telas_pais",
    label: "Consequências do uso e abuso de telas (pais e responsáveis)",
  },
  {
    value: "setembro_amarelo_pais",
    label: "Prevenção Setembro Amarelo (pais e responsáveis)",
  },
  {
    value: "adultizacao",
    label: "Como proteger a criança da adultização (pais e responsáveis)",
  },
  {
    value: "motivacao_servidores",
    label: "Motivação: o combustível do sucesso (Servidores)",
  },
  {
    value: "etica_servidores",
    label: "Ética e respeito: bases para um bom relacionamento (Servidores)",
  },
  {
    value: "conexoes_servidores",
    label: "Conexões que transformam: comunicação clara, vínculos fortes (Servidores)",
  },
  {
    value: "saude_mental_servidores",
    label: "Saúde mental e autocuidado (Servidores)",
  },
  {
    value: "relacionamento_servidores",
    label: "Relacionamento interpessoal (Servidores)",
  },
] as const;

export type VivenciaTema = (typeof vivenciaTemaOptions)[number]["value"];
export type PalestraTema = (typeof palestraTemaOptions)[number]["value"];

export const vivenciaTemaValues = vivenciaTemaOptions.map((o) => o.value) as [
  VivenciaTema,
  ...VivenciaTema[],
];
export const palestraTemaValues = palestraTemaOptions.map((o) => o.value) as [
  PalestraTema,
  ...PalestraTema[],
];

export const vivenciaTemaLabels = Object.fromEntries(
  vivenciaTemaOptions.map((o) => [o.value, o.label]),
) as Record<VivenciaTema, string>;

export const palestraTemaLabels = Object.fromEntries(
  palestraTemaOptions.map((o) => [o.value, o.label]),
) as Record<PalestraTema, string>;

export function vivenciaTemaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return vivenciaTemaLabels[value as VivenciaTema] ?? value;
}

export function palestraTemaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return palestraTemaLabels[value as PalestraTema] ?? value;
}
