import {
  alunoSerieOptions,
  alunoTurmaOptions,
  periodoLabels,
  periodoOptions,
  solicitanteCargoOptions,
  type AlunoSerie,
  type AlunoTurma,
  type PeriodoEscolar,
  type SolicitanteCargo,
} from "./acolhimento-options";

export { alunoSerieOptions, alunoTurmaOptions, periodoOptions, solicitanteCargoOptions };
export type { AlunoSerie, AlunoTurma, PeriodoEscolar, SolicitanteCargo };

export const MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO = 2;

/** Máximo de palestras da mesma escola na mesma data e período. */
export const MAX_PALESTRAS_POR_ESCOLA_DIA_PERIODO = 1;

export function vivenciaDiaPeriodoKey(data: string, periodo: string): string {
  return `${data.slice(0, 10)}|${periodo}`;
}

export function palestraDiaPeriodoKey(data: string, periodo: string): string {
  return vivenciaDiaPeriodoKey(data, periodo);
}

/**
 * Datas que já atingiram o limite de turmas no mesmo período
 * (considerando as outras turmas do formulário, excluindo `excludeIndex`).
 */
export function datesAtTurmaLimitForPeriod(
  groups: Array<{ periodo?: string; data_vivencia?: string }>,
  periodo: string | null | undefined,
  excludeIndex: number,
  limit = MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO,
): string[] {
  if (!periodo?.trim()) return [];
  const counts = new Map<string, number>();
  groups.forEach((g, i) => {
    if (i === excludeIndex) return;
    if (!g.periodo || g.periodo !== periodo || !g.data_vivencia?.trim()) return;
    const key = g.data_vivencia.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].filter(([, n]) => n >= limit).map(([d]) => d);
}

/** Datas já usadas por outras palestras do formulário no mesmo período. */
export function datesAtPalestraLimitForPeriod(
  palestras: Array<{ periodo?: string; data_preferivel?: string }>,
  periodo: string | null | undefined,
  excludeIndex: number,
  limit = MAX_PALESTRAS_POR_ESCOLA_DIA_PERIODO,
): string[] {
  if (!periodo?.trim()) return [];
  const counts = new Map<string, number>();
  palestras.forEach((p, i) => {
    if (i === excludeIndex) return;
    if (!p.periodo || p.periodo !== periodo || !p.data_preferivel?.trim()) return;
    const key = p.data_preferivel.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].filter(([, n]) => n >= limit).map(([d]) => d);
}

/** Quantas outras turmas já usam a mesma data + período (excluindo `excludeIndex`). */
export function countTurmasMesmoDiaPeriodo(
  groups: Array<{ periodo?: string; data_vivencia?: string }>,
  excludeIndex: number,
  data: string | null | undefined,
  periodo: string | null | undefined,
): number {
  if (!data?.trim() || !periodo?.trim()) return 0;
  const day = data.slice(0, 10);
  return groups.filter(
    (g, i) =>
      i !== excludeIndex &&
      g.periodo === periodo &&
      g.data_vivencia?.slice(0, 10) === day,
  ).length;
}

/** Datas que já atingiram o limite de turmas no mesmo período (grupos + Doce Encanto). */
export function datesAtTurmaLimitCombined(
  groups: Array<{ periodo?: string; data_vivencia?: string }>,
  doceGroups: Array<{ periodo?: string; data_vivencia?: string }>,
  periodo: string | null | undefined,
  exclude: { source: "groups" | "doce"; index: number } | null,
  limit = MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO,
): string[] {
  if (!periodo?.trim()) return [];
  const counts = new Map<string, number>();
  const bump = (data: string | undefined, skip: boolean) => {
    if (skip || !data?.trim()) return;
    const key = data.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  groups.forEach((g, i) => {
    if (!g.periodo || g.periodo !== periodo) return;
    bump(g.data_vivencia, exclude?.source === "groups" && exclude.index === i);
  });
  doceGroups.forEach((g, i) => {
    if (!g.periodo || g.periodo !== periodo) return;
    bump(g.data_vivencia, exclude?.source === "doce" && exclude.index === i);
  });
  return [...counts.entries()].filter(([, n]) => n >= limit).map(([d]) => d);
}

export function countTurmasMesmoDiaPeriodoCombined(
  groups: Array<{ periodo?: string; data_vivencia?: string }>,
  doceGroups: Array<{ periodo?: string; data_vivencia?: string }>,
  exclude: { source: "groups" | "doce"; index: number } | null,
  data: string | null | undefined,
  periodo: string | null | undefined,
): number {
  if (!data?.trim() || !periodo?.trim()) return 0;
  const day = data.slice(0, 10);
  let n = 0;
  groups.forEach((g, i) => {
    if (exclude?.source === "groups" && exclude.index === i) return;
    if (g.periodo === periodo && g.data_vivencia?.slice(0, 10) === day) n += 1;
  });
  doceGroups.forEach((g, i) => {
    if (exclude?.source === "doce" && exclude.index === i) return;
    if (g.periodo === periodo && g.data_vivencia?.slice(0, 10) === day) n += 1;
  });
  return n;
}

export function mensagemLimiteTurmasDiaPeriodo(periodo?: string | null): string {
  const periodoLabel = periodo
    ? (periodoLabels[periodo] ?? periodo)
    : "este período";
  return `Máximo de ${MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO} turmas no mesmo dia e período (${periodoLabel}). Escolha outro dia ou outro período.`;
}

export function mensagemLimitePalestrasDiaPeriodo(periodo?: string | null): string {
  const periodoLabel = periodo
    ? (periodoLabels[periodo] ?? periodo)
    : "este período";
  return `A escola só pode solicitar ${MAX_PALESTRAS_POR_ESCOLA_DIA_PERIODO} palestra por período na mesma data (${periodoLabel}). Escolha outro dia ou outro período.`;
}

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
  {
    value: "projeto_joaninha",
    label: "Projeto Joaninha",
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
  {
    value: "comunicacao_nao_violenta",
    label: "Comunicação não violenta",
  },
] as const;

export type VivenciaTema = (typeof vivenciaTemaOptions)[number]["value"];
export type PalestraTema = (typeof palestraTemaOptions)[number]["value"];

/** Tema especial com bloco próprio no formulário público. */
export const DOCE_ENCANTO_TEMA = "doce_encanto" as const satisfies VivenciaTema;

/** Temas exibidos no multi-select (sem Doce Encanto). */
export const vivenciaTemaOptionsPadrao = vivenciaTemaOptions.filter(
  (o) => o.value !== DOCE_ENCANTO_TEMA,
);

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
