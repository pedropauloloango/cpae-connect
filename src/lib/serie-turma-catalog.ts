import { supabase } from "@/integrations/supabase/client";
import {
  alunoSerieOptions as fallbackSerieOptions,
  alunoTurmaOptions as fallbackTurmaOptions,
} from "@/lib/acolhimento-options";

export type CatalogOption = {
  id?: string;
  value: string;
  label: string;
  sort_order?: number;
};

export type CatalogRow = {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function slugifyValue(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/º/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function makeCatalogValue(label: string, existingValues: string[] = []): string {
  const base = slugifyValue(label) || `item_${Date.now()}`;
  if (!existingValues.includes(base)) return base;
  let i = 2;
  while (existingValues.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    msg.includes("school_series") ||
    msg.includes("school_turmas") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

export async function fetchActiveSeries(): Promise<CatalogOption[]> {
  const { data, error } = await supabase
    .from("school_series")
    .select("id, value, label, sort_order")
    .is("deleted_at", null)
    .order("sort_order")
    .order("label");

  if (error) {
    if (isMissingTableError(error)) {
      return fallbackSerieOptions.map((o) => ({ value: o.value, label: o.label }));
    }
    throw error;
  }
  if (!data?.length) {
    return fallbackSerieOptions.map((o) => ({ value: o.value, label: o.label }));
  }
  return data;
}

export async function fetchActiveTurmas(): Promise<CatalogOption[]> {
  const { data, error } = await supabase
    .from("school_turmas")
    .select("id, value, label, sort_order")
    .is("deleted_at", null)
    .order("sort_order")
    .order("label");

  if (error) {
    if (isMissingTableError(error)) {
      return fallbackTurmaOptions.map((o) => ({ value: o.value, label: o.label }));
    }
    throw error;
  }
  if (!data?.length) {
    return fallbackTurmaOptions.map((o) => ({ value: o.value, label: o.label }));
  }
  return data;
}

export async function fetchSeriesAdmin(): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from("school_series")
    .select("id, value, label, sort_order, deleted_at, created_at, updated_at")
    .is("deleted_at", null)
    .order("sort_order")
    .order("label");
  if (error) throw error;
  return (data ?? []) as CatalogRow[];
}

export async function fetchTurmasAdmin(): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from("school_turmas")
    .select("id, value, label, sort_order, deleted_at, created_at, updated_at")
    .is("deleted_at", null)
    .order("sort_order")
    .order("label");
  if (error) throw error;
  return (data ?? []) as CatalogRow[];
}

export function labelsMap(options: CatalogOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}
