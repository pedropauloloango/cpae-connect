import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";

async function resolveAccountStatus(userId: string): Promise<"pendente" | "aprovado" | "rejeitado"> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", userId)
    .maybeSingle();

  if (!error && profile?.account_status) {
    return profile.account_status as "pendente" | "aprovado" | "rejeitado";
  }

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return roles?.length ? "aprovado" : "pendente";
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
    if (status === "aprovado" && onWaitingPage) throw redirect({ to: "/dashboard" });

    return { user: data.user, accountStatus: status };
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
