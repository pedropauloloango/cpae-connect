/** Filtros de drill-through do dashboard Vivências → /modulo-vivencias/demandas */
export const VIVENCIAS_DEMANDAS_FILTROS = [
  "recebida",
  "em_atendimento",
  "concluida",
  "relatorios_validar",
] as const;

export type VivenciasDemandasFiltro = (typeof VIVENCIAS_DEMANDAS_FILTROS)[number];

/** Statuses contados no card "Em Andamento" do dashboard de Vivências. */
export const VIVENCIAS_EM_ATENDIMENTO_STATUSES = [
  "distribuida",
  "em_andamento",
  "em_ajuste",
  "aguardando_aprovacao",
] as const;

export const vivenciasDemandasFiltroLabels: Record<VivenciasDemandasFiltro, string> = {
  recebida: "Solicitações Recebidas",
  em_atendimento: "Em atendimento",
  concluida: "Concluídas",
  relatorios_validar: "Relatórios p/ validar",
};

export function parseVivenciasDemandasFiltro(value: unknown): VivenciasDemandasFiltro | undefined {
  return typeof value === "string" &&
    (VIVENCIAS_DEMANDAS_FILTROS as readonly string[]).includes(value)
    ? (value as VivenciasDemandasFiltro)
    : undefined;
}
