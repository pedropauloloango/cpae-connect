import { supabase } from "@/integrations/supabase/client";

export type ProfessionalModules = {
  professionalId: string | null;
  atendeAcolhimento: boolean;
  atendeVivencias: boolean;
};

export const DEFAULT_ADMIN_MODULES: ProfessionalModules = {
  professionalId: null,
  atendeAcolhimento: true,
  atendeVivencias: true,
};

export const EMPTY_MODULES: ProfessionalModules = {
  professionalId: null,
  atendeAcolhimento: false,
  atendeVivencias: false,
};

/** Rotas que pertencem ao módulo Acolhimento (não compartilhadas com admin genérico). */
const ACOLHIMENTO_PREFIXES = ["/dashboard", "/demandas", "/agenda", "/aprovacoes"];

export function isAcolhimentoPath(pathname: string): boolean {
  return ACOLHIMENTO_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isVivenciasPath(pathname: string): boolean {
  return pathname === "/modulo-vivencias" || pathname.startsWith("/modulo-vivencias/");
}

export function homePathForModules(modules: ProfessionalModules, isAdmin: boolean): string {
  if (isAdmin || modules.atendeAcolhimento) return "/dashboard";
  if (modules.atendeVivencias) return "/modulo-vivencias/dashboard";
  return "/aguardando-aprovacao";
}

export async function fetchProfessionalModules(userId: string): Promise<ProfessionalModules> {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, atende_acolhimento, atende_vivencias")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return EMPTY_MODULES;

  return {
    professionalId: data.id,
    atendeAcolhimento: data.atende_acolhimento !== false,
    atendeVivencias: data.atende_vivencias !== false,
  };
}

export async function resolveUserModulesAccess(userId: string): Promise<{
  isAdmin: boolean;
  modules: ProfessionalModules;
}> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin",
  );
  if (isAdmin) {
    return { isAdmin: true, modules: DEFAULT_ADMIN_MODULES };
  }
  const modules = await fetchProfessionalModules(userId);
  return { isAdmin: false, modules };
}
