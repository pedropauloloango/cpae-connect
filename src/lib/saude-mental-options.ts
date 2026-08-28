/** Opções e helpers do formulário Saúde Mental na Educação. */

export const nivelEscolaridadeOptions = [
  { value: "ensino_medio", label: "Ensino Médio" },
  { value: "ensino_medio_incompleto", label: "Ensino Médio incompleto" },
  { value: "superior", label: "Superior" },
  { value: "superior_incompleto", label: "Superior incompleto" },
  { value: "pos_graduacao", label: "Pós-graduação" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
  { value: "outro", label: "Outro" },
] as const;

export type NivelEscolaridade = (typeof nivelEscolaridadeOptions)[number]["value"];

export const nivelEscolaridadeLabels: Record<string, string> = Object.fromEntries(
  nivelEscolaridadeOptions.map((o) => [o.value, o.label]),
);

export const moduloCursoOptions = [
  { value: "Módulo 1", label: "Módulo 1" },
  { value: "Módulo 2", label: "Módulo 2" },
  { value: "Módulo 3", label: "Módulo 3" },
  { value: "Módulo 4", label: "Módulo 4" },
  { value: "Módulo 5", label: "Módulo 5" },
  { value: "Módulo 6", label: "Módulo 6" },
  { value: "Módulo 7", label: "Módulo 7" },
  { value: "Módulo 8", label: "Módulo 8" },
  { value: "Módulo 9", label: "Módulo 9" },
] as const;

export const qrRecebimentoDuracaoOptions = [
  { value: 5, label: "5 minutos" },
  { value: 10, label: "10 minutos" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "60 minutos" },
] as const;

export const encontroStatusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "realizado", label: "Realizado" },
] as const;

export const encontroStatusLabels: Record<string, string> = Object.fromEntries(
  encontroStatusOptions.map((o) => [o.value, o.label]),
);

/** Normaliza texto livre de escolaridade da planilha para valor canônico quando possível. */
export function normalizeNivelEscolaridade(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const v = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (v.includes("doutor")) return "doutorado";
  if (v.includes("mestrado")) return "mestrado";
  if (v.includes("pos") || v.includes("especialist") || v.includes("psicopedagog")) return "pos_graduacao";
  if (v.includes("superior incompleto") || v.includes("cursando superior")) return "superior_incompleto";
  if (v.includes("superior") || v.includes("pedagog")) return "superior";
  if (v.includes("medio incompleto")) return "ensino_medio_incompleto";
  if (v.includes("medio") || v.includes("médio")) return "ensino_medio";
  return raw.trim();
}

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCpfMask(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
