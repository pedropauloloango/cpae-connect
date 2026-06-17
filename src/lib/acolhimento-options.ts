export const regiaoEscolaOptions = [
  { value: "anhanduizinho", label: "Anhanduizinho" },
  { value: "bandeira", label: "Bandeira" },
  { value: "centro", label: "Centro" },
  { value: "imbirussu", label: "Imbirussú" },
  { value: "lagoa", label: "Lagoa" },
  { value: "prosa", label: "Prosa" },
  { value: "rural", label: "Rural" },
  { value: "segredo", label: "Segredo" },
] as const;

export const modalidadeOptions = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "On-line (aluno precisa estar na escola)" },
] as const;

export const periodoOptions = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "integral", label: "Integral" },
  { value: "noturno", label: "Noturno" },
] as const;

export const comunicouAbusoOptions = [
  { value: "conselho_tutelar", label: "Conselho Tutelar" },
  { value: "orgao_semed", label: "Órgão competente da SEMED (DAE / SUGENOR)" },
  { value: "nao_se_aplica", label: "Não se aplica" },
  { value: "outra_rede", label: "Outra Rede de proteção" },
  { value: "outro", label: "Outro" },
] as const;

export const situacaoObservadaOptions = [
  { value: "autolesao", label: "Autolesão" },
  { value: "ideacao_suicida", label: "Ideação suicida" },
  { value: "ansiedade_depressao", label: "Ansiedade / depressão" },
  { value: "bullying", label: "Bullying" },
  { value: "luto", label: "Luto" },
  { value: "outro", label: "Outro" },
] as const;

export const autorizacaoAtaOptions = [
  { value: "ja_temos", label: "Já temos a autorização" },
  { value: "ainda_nao", label: "Ainda não temos a autorização e iremos providenciar" },
] as const;

export const solicitanteCargoOptions = [
  { value: "diretor", label: "Diretor(a)" },
  { value: "diretor_adjunto", label: "Diretor(a) Adjunto" },
  { value: "coordenador_pedagogico", label: "Coordenador Pedagógico" },
  { value: "secretario", label: "Secretário(a)" },
] as const;

export const alunoSexoOptions = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
] as const;

export const alunoSerieOptions = [
  { value: "grupo_1", label: "Grupo 1" },
  { value: "grupo_2", label: "Grupo 2" },
  { value: "grupo_3", label: "Grupo 3" },
  { value: "grupo_4", label: "Grupo 4" },
  { value: "grupo_5", label: "Grupo 5" },
  { value: "1", label: "1º ano" },
  { value: "2", label: "2º ano" },
  { value: "3", label: "3º ano" },
  { value: "4", label: "4º ano" },
  { value: "5", label: "5º ano" },
  { value: "6", label: "6º ano" },
  { value: "7", label: "7º ano" },
  { value: "8", label: "8º ano" },
  { value: "9", label: "9º ano" },
] as const;

export const alunoTurmaOptions = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "G", label: "G" },
  { value: "H", label: "H" },
  { value: "I", label: "I" },
  { value: "J", label: "J" },
] as const;

export type SolicitanteCargo = (typeof solicitanteCargoOptions)[number]["value"];
export type AlunoSexo = (typeof alunoSexoOptions)[number]["value"];
export type AlunoSerie = (typeof alunoSerieOptions)[number]["value"];
export type AlunoTurma = (typeof alunoTurmaOptions)[number]["value"];

export const solicitanteCargoValues = solicitanteCargoOptions.map((o) => o.value) as [
  SolicitanteCargo,
  ...SolicitanteCargo[],
];
export const alunoSerieValues = alunoSerieOptions.map((o) => o.value) as [AlunoSerie, ...AlunoSerie[]];
export const alunoTurmaValues = alunoTurmaOptions.map((o) => o.value) as [AlunoTurma, ...AlunoTurma[]];

export type RegiaoEscola = (typeof regiaoEscolaOptions)[number]["value"];
export type ModalidadeAcolhimento = (typeof modalidadeOptions)[number]["value"];
export type PeriodoEscolar = (typeof periodoOptions)[number]["value"];
export type ComunicouAbuso = (typeof comunicouAbusoOptions)[number]["value"];
export type SituacaoObservada = (typeof situacaoObservadaOptions)[number]["value"];
export type AutorizacaoAta = (typeof autorizacaoAtaOptions)[number]["value"];

export const regiaoEscolaLabels = Object.fromEntries(regiaoEscolaOptions.map((o) => [o.value, o.label]));
export const modalidadeLabels = Object.fromEntries(modalidadeOptions.map((o) => [o.value, o.label]));
export const periodoLabels = Object.fromEntries(periodoOptions.map((o) => [o.value, o.label]));
export const comunicouAbusoLabels = Object.fromEntries(comunicouAbusoOptions.map((o) => [o.value, o.label]));
export const situacaoObservadaLabels = Object.fromEntries(situacaoObservadaOptions.map((o) => [o.value, o.label]));
export const autorizacaoAtaLabels = Object.fromEntries(autorizacaoAtaOptions.map((o) => [o.value, o.label]));
export const solicitanteCargoLabels = Object.fromEntries(solicitanteCargoOptions.map((o) => [o.value, o.label]));
export const alunoSexoLabels = Object.fromEntries(alunoSexoOptions.map((o) => [o.value, o.label]));
export const alunoSerieLabels = Object.fromEntries(alunoSerieOptions.map((o) => [o.value, o.label]));
export const alunoTurmaLabels = Object.fromEntries(alunoTurmaOptions.map((o) => [o.value, o.label]));

/** Converte região cadastrada na escola para valor do formulário (enum ou texto). */
export function normalizeRegiaoFromSchool(regiao: string | null | undefined): string {
  if (!regiao?.trim()) return "";
  const norm = regiao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const match = regiaoEscolaOptions.find(
    (o) =>
      o.value === norm ||
      o.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "") === norm,
  );
  return match?.value ?? regiao.trim();
}

export function regiaoEscolaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return regiaoEscolaLabels[value] ?? value;
}

/** Mantém compatibilidade com gráficos que usam tipo_queixa. */
export function deriveTipoQueixa(situacoes: SituacaoObservada[]): string {
  const priority: SituacaoObservada[] = [
    "ideacao_suicida",
    "ansiedade_depressao",
    "bullying",
    "autolesao",
    "luto",
    "outro",
  ];
  for (const key of priority) {
    if (situacoes.includes(key)) {
      if (key === "autolesao" || key === "luto" || key === "outro") return "outros";
      return key;
    }
  }
  return "outros";
}
