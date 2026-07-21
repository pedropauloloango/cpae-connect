import { supabase } from "@/integrations/supabase/client";

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

/**
 * Datas preferíveis já solicitadas na mesma região e período (vivências).
 * Usa RPC SECURITY DEFINER (formulário público / anon).
 */
export async function fetchVivenciaOccupiedDates(
  regiao: string | null | undefined,
  periodo: string | null | undefined,
): Promise<string[]> {
  const regiaoKey = regiao?.trim();
  const periodoKey = periodo?.trim();
  if (!regiaoKey || !periodoKey) return [];

  const { data, error } = await supabase.rpc("get_vivencia_occupied_dates", {
    p_regiao: regiaoKey,
    p_periodo: periodoKey,
  });

  if (error) throw error;

  return mapOccupiedRows(data);
}

/**
 * Datas ocupadas para palestra na mesma região (palestras + vivências).
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
