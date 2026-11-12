import { regiaoEscolaLabel } from "@/lib/acolhimento-options";

/** `ano` = "AAAA" | "todos"; `mes` = "MM" | "todos"; registros guardam `mes` como "AAAA-MM". */
export type DashboardFiltros = { ano: string; mes: string; regiao: string };

export const FILTROS_DASHBOARD_PADRAO: DashboardFiltros = { ano: "todos", mes: "todos", regiao: "todas" };

export type FiltroOpcao = { value: string; label: string };

const MESES_LONGOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PAGE_SIZE = 1000;

/** Busca todas as linhas contornando o limite de 1000 registros por resposta do PostgREST. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

export function mesKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function mesKeyDeIso(iso: string): string {
  return mesKey(new Date(iso));
}

export function mesLabel(key: string): string {
  const [ano, mes] = key.split("-").map(Number);
  return `${MESES_LONGOS[mes - 1]} de ${ano}`;
}

/** Intervalo [início, fim) do mês em ISO, no fuso local. */
export function intervaloDoMes(key: string): { inicio: string; fim: string } {
  const [ano, mes] = key.split("-").map(Number);
  return {
    inicio: new Date(ano, mes - 1, 1).toISOString(),
    fim: new Date(ano, mes, 1).toISOString(),
  };
}

export function regiaoDoRegistro(regiaoEscola: string | null | undefined, regiaoDaEscola: string | null | undefined): string {
  const raw = regiaoEscola?.trim() || regiaoDaEscola?.trim();
  if (!raw) return "Sem região";
  return regiaoEscolaLabel(raw) || raw;
}

export function opcoesDeAno(registros: { mes: string }[]): FiltroOpcao[] {
  return [...new Set(registros.map((r) => r.mes.slice(0, 4)))]
    .sort((a, b) => b.localeCompare(a))
    .map((ano) => ({ value: ano, label: ano }));
}

/** Meses com registros no ano informado (ou em qualquer ano quando "todos"). */
export function opcoesDeMes(registros: { mes: string }[], ano: string): FiltroOpcao[] {
  return [
    ...new Set(
      registros.filter((r) => ano === "todos" || r.mes.startsWith(`${ano}-`)).map((r) => r.mes.slice(5, 7)),
    ),
  ]
    .sort()
    .map((mes) => ({ value: mes, label: MESES_LONGOS[Number(mes) - 1] }));
}

/** Mês ("AAAA-MM") usado como referência para indicadores mensais, conforme os filtros de ano/mês. */
export function mesReferencia(filtros: DashboardFiltros): string {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  if (filtros.ano !== "todos" && filtros.mes !== "todos") return `${filtros.ano}-${filtros.mes}`;
  if (filtros.ano !== "todos") return Number(filtros.ano) === anoAtual ? mesKey(hoje) : `${filtros.ano}-12`;
  if (filtros.mes !== "todos") {
    const ano = Number(filtros.mes) <= mesAtual ? anoAtual : anoAtual - 1;
    return `${ano}-${filtros.mes}`;
  }
  return mesKey(hoje);
}

export function opcoesDeRegiao(registros: { regiao: string }[]): FiltroOpcao[] {
  return [...new Set(registros.map((r) => r.regiao))]
    .sort((a, b) => {
      if (a === "Sem região") return 1;
      if (b === "Sem região") return -1;
      return a.localeCompare(b, "pt-BR");
    })
    .map((nome) => ({ value: nome, label: nome }));
}

export function aplicarFiltros<T extends { mes: string; regiao: string }>(
  registros: T[],
  filtros: DashboardFiltros,
  { ignorarPeriodo = false }: { ignorarPeriodo?: boolean } = {},
): T[] {
  return registros.filter(
    (r) =>
      (ignorarPeriodo || filtros.ano === "todos" || r.mes.startsWith(`${filtros.ano}-`)) &&
      (ignorarPeriodo || filtros.mes === "todos" || r.mes.endsWith(`-${filtros.mes}`)) &&
      (filtros.regiao === "todas" || r.regiao === filtros.regiao),
  );
}

/**
 * Com só o ano escolhido, mostra os 12 meses daquele ano; nos demais casos,
 * os seis meses que terminam no mês de referência.
 */
export function evolucaoMensal(
  registros: { mes: string }[],
  filtros: DashboardFiltros,
): { mes: string; total: number }[] {
  const anoInteiro = filtros.ano !== "todos" && filtros.mes === "todos";
  const [ano, mes] = (anoInteiro ? `${filtros.ano}-12` : mesReferencia(filtros)).split("-").map(Number);
  const quantidade = anoInteiro ? 12 : 6;
  const buckets = new Map<string, number>();
  for (let i = quantidade - 1; i >= 0; i--) buckets.set(mesKey(new Date(ano, mes - 1 - i, 1)), 0);
  registros.forEach((r) => {
    if (buckets.has(r.mes)) buckets.set(r.mes, (buckets.get(r.mes) ?? 0) + 1);
  });
  return Array.from(buckets.entries()).map(([k, v]) => ({
    mes: MESES_CURTOS[Number(k.split("-")[1]) - 1],
    total: v,
  }));
}
