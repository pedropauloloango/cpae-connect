import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  homePathForModules,
  isAcolhimentoPath,
  isVivenciasPath,
  resolveUserModulesAccess,
} from "@/lib/professional-modules";

async function resolveAccountStatus(
  userId: string,
): Promise<"pendente" | "aprovado" | "rejeitado"> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roleList = roles ?? [];
  const isAdmin = roleList.some((r) => r.role === "admin" || r.role === "super_admin");

  // Admin com papel ativo nunca fica preso em "aguardando aprovação"
  if (isAdmin) {
    if (profile?.account_status !== "aprovado") {
      await supabase.from("profiles").update({ account_status: "aprovado" }).eq("id", userId);
    }
    return "aprovado";
  }

  if (profile?.account_status === "rejeitado") return "rejeitado";
  if (profile?.account_status === "aprovado") return "aprovado";
  if (profile?.account_status === "pendente") return "pendente";

  return roleList.length ? "aprovado" : "pendente";
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const status = await resolveAccountStatus(data.user.id);
    const onWaitingPage = location.pathname === "/aguardando-aprovacao";

    if (status === "rejeitado") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (status === "pendente" && !onWaitingPage) throw redirect({ to: "/aguardando-aprovacao" });

    const { isAdmin, modules } = await resolveUserModulesAccess(data.user.id);
    const home = homePathForModules(modules, isAdmin);

    if (status === "aprovado" && onWaitingPage) throw redirect({ to: home });

    if (!onWaitingPage) {
      if (isVivenciasPath(location.pathname) && !isAdmin && !modules.atendeVivencias) {
        throw redirect({ to: home });
      }
      if (isAcolhimentoPath(location.pathname) && !isAdmin && !modules.atendeAcolhimento) {
        throw redirect({ to: home });
      }
    }

    return {
      user: data.user,
      accountStatus: status,
      isAdmin,
      modules,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/aguardando-aprovacao") {
    return <Outlet />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
