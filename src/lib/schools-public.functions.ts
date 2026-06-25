import { createServerFn } from "@tanstack/react-start";

export type PublicSchoolOption = {
  id: string;
  nome: string;
  regiao: string | null;
  tipo_escola: "escola" | "emei" | null;
};

/** Lista escolas ativas (fallback servidor quando o browser não alcança o Supabase). */
export const fetchPublicSchools = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, nome, regiao, tipo_escola")
    .is("deleted_at", null)
    .eq("status", "ativa")
    .order("nome");

  if (error) throw error;
  return (data ?? []) as PublicSchoolOption[];
});
