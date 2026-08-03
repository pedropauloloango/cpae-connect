/** Filtros de drill-through do dashboard → /demandas */
export const DEMANDAS_FILTROS = ["recebida", "em_atendimento", "concluida", "atendimentos_mes"] as const;

export type DemandasFiltro = (typeof DEMANDAS_FILTROS)[number];

/** Statuses contados no card "Em Andamento" do dashboard. */
export const EM_ATENDIMENTO_STATUSES = [
  "distribuida",
  "em_andamento",
  "em_ajuste",
  "aguardando_aprovacao",
] as const;

export const demandasFiltroLabels: Record<DemandasFiltro, string> = {
  recebida: "Solicitações Recebidas",
  em_atendimento: "Em atendimento",
  concluida: "Concluídas",
  atendimentos_mes: "Atendimentos no mês",
};

export function parseDemandasFiltro(value: unknown): DemandasFiltro | undefined {
  return typeof value === "string" && (DEMANDAS_FILTROS as readonly string[]).includes(value)
    ? (value as DemandasFiltro)
    : undefined;
}
