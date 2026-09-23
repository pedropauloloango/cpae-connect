import { supabase } from "@/integrations/supabase/client";
import {
  MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO,
  WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO,
} from "@/lib/vivencias-options";

/** Converte Date local para YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Interpreta YYYY-MM-DD como data local (evita shift de fuso). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export type VivenciaDateCount = {
  data_preferivel: string;
  qtd: number;
};

/**
 * Contagens de turmas por data na mesma região e período (vivências).
 * Usa RPC SECURITY DEFINER (formulário público / anon).
 */
export async function fetchVivenciaDateCounts(
  regiao: string | null | undefined,
  periodo: string | null | undefined,
): Promise<Map<string, number>> {
  const regiaoKey = regiao?.trim();
  const periodoKey = periodo?.trim();
  if (!regiaoKey || !periodoKey) return new Map();

  const { data, error } = await supabase.rpc("get_vivencia_occupied_dates", {
    p_regiao: regiaoKey,
    p_periodo: periodoKey,
  });

  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key =
      typeof row.data_preferivel === "string" ? row.data_preferivel.slice(0, 10) : null;
    if (!key) continue;
    const rawQtd = (row as { qtd?: number | string | null }).qtd;
    // RPC antiga sem coluna qtd: trata como alerta (selecionável), não como bloqueio.
    const qtd =
      rawQtd === undefined || rawQtd === null || rawQtd === ""
        ? WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO
        : Number(rawQtd);
    map.set(key, Number.isFinite(qtd) ? qtd : WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO);
  }
  return map;
}

/**
 * Datas bloqueadas (atingiram o limite). Compatível com o uso antigo da RPC.
 */
export async function fetchVivenciaOccupiedDates(
  regiao: string | null | undefined,
  periodo: string | null | undefined,
): Promise<string[]> {
  const counts = await fetchVivenciaDateCounts(regiao, periodo);
  return [...counts.entries()]
    .filter(([, qtd]) => qtd >= MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO)
    .map(([d]) => d);
}

export function countSiblingDatesOnDay(siblingDates: string[], day: string): number {
  const key = day.slice(0, 10);
  return siblingDates.filter((d) => d?.slice(0, 10) === key).length;
}

export function vivenciaCalendarDayState(
  remoteCount: number,
  formSiblingCount: number,
): { warning: boolean; blocked: boolean; total: number } {
  const total = remoteCount + formSiblingCount;
  return {
    total,
    warning: total >= WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO,
    blocked: total >= MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO,
  };
}

/**
 * Datas ocupadas para palestra na mesma região (palestras + vivências).
 * @deprecated Preferir fetchPalestraSchoolOccupiedDates (limite por escola + período).
 */
export async function fetchPalestraOccupiedDates(
  regiao: string | null | undefined,
): Promise<string[]> {
  const regiaoKey = regiao?.trim();
  if (!regiaoKey) return [];

  const { data, error } = await supabase.rpc("get_palestra_occupied_dates", {
    p_regiao: regiaoKey,
  });

  if (error) throw error;

  return mapOccupiedRows(data);
}

/**
 * Datas em que a escola já tem palestra solicitada no mesmo período.
 */
export async function fetchPalestraSchoolOccupiedDates(
  schoolId: string | null | undefined,
  periodo: string | null | undefined,
): Promise<string[]> {
  const schoolKey = schoolId?.trim();
  const periodoKey = periodo?.trim();
  if (!schoolKey || !periodoKey) return [];

  const { data, error } = await supabase.rpc("get_palestra_school_occupied_dates", {
    p_school_id: schoolKey,
    p_periodo: periodoKey,
  });

  if (error) {
    // Função ainda não aplicada no banco — não bloqueia o calendário.
    if (error.code === "PGRST202" || error.message?.includes("Could not find the function")) {
      return [];
    }
    throw error;
  }

  return mapOccupiedRows(data);
}

function mapOccupiedRows(
  data: { data_preferivel: string }[] | null,
): string[] {
  return (data ?? [])
    .map((row) => {
      const value = row.data_preferivel;
      return typeof value === "string" ? value.slice(0, 10) : null;
    })
    .filter((v): v is string => Boolean(v));
}
