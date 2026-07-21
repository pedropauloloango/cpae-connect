import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { homePathForModules, resolveUserModulesAccess } from "@/lib/professional-modules";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { isAdmin, modules } = await resolveUserModulesAccess(auth.user.id);
    if (!isAdmin) throw redirect({ to: homePathForModules(modules, isAdmin) });
  },
  component: () => <Outlet />,
});
