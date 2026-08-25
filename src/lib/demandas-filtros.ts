import { supabase } from "@/integrations/supabase/client";

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

export function currentMonthStartIso(): string {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

/**
 * IDs de demandas de Acolhimento (não excluídas) com pelo menos um agendamento
 * no mês corrente — mesma base do card "Atendimentos no Mês" e do filtro em /demandas.
 */
export async function fetchRequestIdsComAtendimentoNoMes(
  professionalId?: string | null,
): Promise<string[]> {
  let qAppt = supabase
    .from("appointments")
    .select("request_id")
    .gte("inicio", currentMonthStartIso())
    .is("vivencia_request_id", null)
    .not("request_id", "is", null);

  if (professionalId) qAppt = qAppt.eq("professional_id", professionalId);

  const { data: appts, error: apptErr } = await qAppt;
  if (apptErr) throw apptErr;

  const ids = [
    ...new Set(
      (appts ?? [])
        .map((a) => a.request_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return [];

  const { data: requests, error: reqErr } = await supabase
    .from("requests")
    .select("id")
    .in("id", ids)
    .is("deleted_at", null);
  if (reqErr) throw reqErr;

  return (requests ?? []).map((r) => r.id);
}
