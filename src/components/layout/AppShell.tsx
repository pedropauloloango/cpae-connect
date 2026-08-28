import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useLayoutEffect, useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Inbox,
  School,
  Users,
  Calendar,
  CheckSquare,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
  UserCog,
  Sparkles,
  HeartHandshake,
  Brain,
  ClipboardCheck,
  KeyRound,
  CalendarClock,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PageHeaderProvider, usePageHeaderContext } from "@/components/layout/page-header-context";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import {
  isSaudeMentalModuleActive,
  isVivenciasModuleActive,
  resolveActiveModule,
} from "@/lib/active-module";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  admin?: boolean;
  /** Match exact path only (for Cadastro /escolas vs /escolas/serie-turma). */
  exact?: boolean;
}

type ModuleTone = "acolhimento" | "vivencias" | "saude-mental" | "neutral";

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  admin?: boolean;
  tone: ModuleTone;
  /** Paths that keep this group expanded / marked active. */
  matchPaths: string[];
  children: NavItem[];
}

const MODULE_GROUPS: NavGroup[] = [
  {
    id: "acolhimento",
    label: "Acolhimento",
    icon: HeartHandshake,
    tone: "acolhimento",
    matchPaths: ["/dashboard", "/demandas", "/agenda", "/aprovacoes"],
    children: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/demandas", label: "Demandas", icon: Inbox },
      { to: "/agenda", label: "Agenda", icon: Calendar },
      { to: "/aprovacoes", label: "Aprovações", icon: CheckSquare, admin: true },
    ],
  },
  {
    id: "vivencias",
    label: "Vivências",
    icon: Sparkles,
    tone: "vivencias",
    matchPaths: ["/modulo-vivencias"],
    children: [
      { to: "/modulo-vivencias/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/modulo-vivencias/demandas", label: "Demandas", icon: Inbox },
      { to: "/modulo-vivencias/visitas-tecnicas", label: "Visita técnica", icon: ClipboardCheck },
      { to: "/modulo-vivencias/agenda", label: "Agenda", icon: Calendar },
    ],
  },
  {
    id: "saude-mental",
    label: "Saúde Mental",
    icon: Brain,
    tone: "saude-mental",
    matchPaths: ["/modulo-saude-mental"],
    children: [
      { to: "/modulo-saude-mental/inscritos", label: "Inscritos", icon: Inbox },
      { to: "/modulo-saude-mental/inscricoes-periodo", label: "Período de inscrições", icon: CalendarClock },
      { to: "/modulo-saude-mental/modulos", label: "Módulos", icon: Layers },
      { to: "/modulo-saude-mental/presenca", label: "Presença", icon: ClipboardCheck },
    ],
  },
];

const CONFIG_GROUP: NavGroup = {
  id: "configuracoes",
  label: "Configurações",
  icon: Settings,
  admin: true,
  tone: "neutral",
  matchPaths: ["/configuracoes", "/escolas", "/profissionais"],
  children: [
    { to: "/configuracoes/usuarios", label: "Usuários", icon: UserCog },
    { to: "/profissionais", label: "Profissionais", icon: Users },
    { to: "/escolas", label: "Escolas", icon: School, exact: true },
    { to: "/escolas/serie-turma", label: "Série/Turma", icon: Layers },
  ],
};

function pathMatches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function childIsActive(pathname: string, child: NavItem): boolean {
  if (child.exact) return pathname === child.to;
  return pathname === child.to || pathname.startsWith(`${child.to}/`);
}

function displayName(email: string | undefined, metadata?: Record<string, unknown>) {
  const full = metadata?.full_name;
  if (typeof full === "string" && full.trim()) return full.trim();
  if (!email) return "Usuário";
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PageHeaderProvider>
      <AppShellLayout>{children}</AppShellLayout>
    </PageHeaderProvider>
  );
}

function AppShellLayout({ children }: { children: ReactNode }) {
  const { meta } = usePageHeaderContext();
  const [open, setOpen] = useState(false);
  const { isAdmin, isSuperAdmin, user, signOut, canAccessAcolhimento, canAccessVivencias, canAccessSaudeMental } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isVivencias = isVivenciasModuleActive(pathname);
  const isSaudeMental = isSaudeMentalModuleActive(pathname);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const visibleModuleGroups = MODULE_GROUPS.filter((g) => {
    if (g.id === "acolhimento") return canAccessAcolhimento;
    if (g.id === "vivencias") return canAccessVivencias;
    if (g.id === "saude-mental") return canAccessSaudeMental;
    return true;
  });

  const visibleGroups: NavGroup[] = [
    ...visibleModuleGroups,
    ...(isAdmin ? [CONFIG_GROUP] : []),
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const activeModule = resolveActiveModule(pathname);
    for (const g of MODULE_GROUPS) {
      initial[g.id] = g.id === activeModule;
    }
    initial[CONFIG_GROUP.id] = pathMatches(pathname, CONFIG_GROUP.matchPaths);
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      const activeModule = resolveActiveModule(pathname);
      for (const g of MODULE_GROUPS) {
        next[g.id] = g.id === activeModule;
      }
      if (pathMatches(pathname, CONFIG_GROUP.matchPaths)) {
        next[CONFIG_GROUP.id] = true;
      }
      return next;
    });
  }, [pathname]);

  const homeTo = canAccessAcolhimento
    ? "/dashboard"
    : canAccessVivencias
      ? "/modulo-vivencias/dashboard"
      : canAccessSaudeMental
        ? "/modulo-saude-mental/inscritos"
        : "/dashboard";

  const userName = displayName(user?.email, user?.user_metadata as Record<string, unknown> | undefined);
  const userInitials = userName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!user?.id) {
      setMustChangePassword(false);
      setChangePasswordOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (error.message?.includes("must_change_password") || error.code === "PGRST204") return;
        console.error("must_change_password check", error);
        return;
      }
      if (data?.must_change_password) {
        setMustChangePassword(true);
        setChangePasswordOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const openOnlyModuleGroup = (moduleId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of MODULE_GROUPS) {
        next[g.id] = g.id === moduleId;
      }
      return next;
    });
  };

  const handleGroupClick = (group: NavGroup) => {
    const groupActive = pathMatches(pathname, group.matchPaths);
    const expanded = openGroups[group.id] ?? groupActive;
    const children = group.children.filter((c) => !c.admin || isAdmin);
    const home = children[0];

    // Configurações: só abre/fecha, sem fechar o módulo ativo.
    if (group.tone === "neutral") {
      setOpenGroups((prev) => ({ ...prev, [group.id]: !expanded }));
      return;
    }

    // Já no módulo aberto: mantém expandido (sempre um módulo aberto).
    if (groupActive && expanded) return;

    openOnlyModuleGroup(group.id);

    if (home && !groupActive) {
      void navigate({ to: home.to });
      setOpen(false);
    }
  };

  const groupHeaderClass = (active: boolean, tone: ModuleTone) =>
    cn(
      "relative flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? tone === "vivencias"
          ? "bg-emerald-500/30 text-white"
          : tone === "saude-mental"
            ? "bg-violet-500/30 text-white"
            : tone === "acolhimento"
              ? "bg-[#0F52BA]/35 text-white"
              : "bg-white/15 text-white"
        : "text-[#CBD5E1] hover:bg-white/8 hover:text-white",
    );

  const subLinkClass = (active: boolean, tone: ModuleTone) =>
    cn(
      "flex items-center gap-3 rounded-xl py-2 pl-10 pr-3 text-sm transition-all duration-200",
      active
        ? tone === "vivencias"
          ? "bg-emerald-500/25 font-medium text-white"
          : tone === "saude-mental"
            ? "bg-violet-500/25 font-medium text-white"
            : tone === "acolhimento"
              ? "bg-[#0F52BA]/30 font-medium text-white"
              : "bg-white/12 font-medium text-white"
        : "text-[#94A3B8] hover:bg-white/8 hover:text-[#E2E8F0]",
    );

  const accentMuted = isSaudeMental
    ? "text-violet-200/70"
    : isVivencias
      ? "text-emerald-200/70"
      : "text-[#93C5FD]/55";
  const accentSoft = isSaudeMental
    ? "text-violet-200/80"
    : isVivencias
      ? "text-emerald-200/80"
      : "text-[#93C5FD]/80";
  const toneIcon = (tone: ModuleTone, active: boolean) =>
    cn(
      "h-[18px] w-[18px] shrink-0",
      active
        ? tone === "vivencias"
          ? "text-emerald-300"
          : tone === "saude-mental"
            ? "text-violet-300"
            : tone === "acolhimento"
              ? "text-[#7DD3FC]"
              : "text-white"
        : "text-[#94A3B8]",
    );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-[#0F172A]/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "cpae-sidebar fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col text-white transition-transform lg:static lg:relative lg:translate-x-0",
          isVivencias && "cpae-sidebar--vivencias",
          isSaudeMental && "cpae-sidebar--saude-mental",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="cpae-sidebar-glow" aria-hidden />

        <div className="relative flex h-[72px] items-center justify-between gap-3 border-b border-white/10 px-5">
          <Link
            to={homeTo}
            className="flex min-w-0 items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <div className="rounded-xl bg-white/95 p-1 shadow-md ring-1 ring-white/20">
              <img src="/logo_CPAE.png" alt="CPAE" className="h-9 w-9 shrink-0 object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-white">Gestão CPAE</div>
              <div className={cn("text-[11px] font-medium uppercase tracking-wide", accentSoft)}>
                Hub de Sistemas
              </div>
            </div>
          </Link>
          <button
            className="rounded-lg p-2 text-[#CBD5E1] hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 pt-3">
          <div className={cn("mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]", accentMuted)}>
            Módulos
          </div>

          {visibleGroups.map((group) => {
            const groupActive = pathMatches(pathname, group.matchPaths);
            const expanded = openGroups[group.id] ?? groupActive;
            const children = group.children.filter((c) => !c.admin || isAdmin);

            if (children.length === 0) return null;

            return (
              <div key={group.id} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => handleGroupClick(group)}
                  className={groupHeaderClass(groupActive, group.tone)}
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <group.icon className={toneIcon(group.tone, groupActive)} />
                    <span className="truncate">{group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>

                {expanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {children.map((child) => {
                      const active = childIsActive(pathname, child);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setOpen(false)}
                          className={subLinkClass(active, group.tone)}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className={cn(
            "cpae-rainbow-border absolute right-0 top-0 bottom-0 z-10 w-[3px]",
            isVivencias && "cpae-rainbow-border--vivencias",
            isSaudeMental && "cpae-rainbow-border--saude-mental",
          )}
          aria-hidden
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "cpae-app-header sticky top-0 z-20 relative flex min-h-[72px] items-center gap-3 px-4 py-3 backdrop-blur-md lg:px-6",
            isVivencias && "cpae-app-header--vivencias",
            isSaudeMental && "cpae-app-header--saude-mental",
          )}
        >
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className={cn(
              "shrink-0 rounded-xl p-2 transition-colors hover:bg-white/70 lg:hidden",
              isSaudeMental
                ? "text-violet-700"
                : isVivencias
                  ? "text-emerald-700"
                  : "text-[#0F52BA]",
            )}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            {meta.title ? (
              <>
                <h1 className="relative inline-block truncate text-lg font-bold tracking-tight text-[#0F172A] sm:text-xl">
                  {meta.title}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 left-0 h-0.5 w-8 rounded-full",
                      isSaudeMental
                        ? "bg-violet-500"
                        : isVivencias
                          ? "bg-emerald-500"
                          : "bg-[#F7B500]",
                    )}
                    aria-hidden
                  />
                </h1>
                {meta.description && (
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-[#64748B] sm:text-xs">
                    {meta.description}
                  </p>
                )}
              </>
            ) : null}
          </div>

          {meta.actions && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">{meta.actions}</div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/75 py-1.5 pl-1.5 pr-2 shadow-sm backdrop-blur-sm outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-[#0F52BA]/30 sm:gap-3 sm:pr-3"
                  aria-label="Menu da conta"
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white",
                      isSaudeMental
                        ? "bg-gradient-to-br from-violet-500 to-purple-800"
                        : isVivencias
                          ? "bg-gradient-to-br from-emerald-500 to-teal-700"
                          : "bg-gradient-to-br from-[#0F52BA] to-[#7B2CBF]",
                    )}
                  >
                    {userInitials}
                  </div>
                  <div className="hidden min-w-0 text-left md:block">
                    <div className="truncate text-sm font-semibold text-[#0F172A]">{userName}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {isAdmin ? (isSuperAdmin ? "Super Admin" : "Coordenador") : "Profissional"}
                    </div>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 text-[#64748B] sm:block" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[11rem]">
                <DropdownMenuItem
                  onSelect={() => {
                    setMustChangePassword(false);
                    setChangePasswordOpen(true);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Trocar senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {meta.actions && (
          <div
            className={cn(
              "flex justify-end border-b px-4 py-2 sm:hidden",
              isSaudeMental
                ? "border-violet-500/10 bg-violet-50/80"
                : isVivencias
                  ? "border-emerald-500/10 bg-emerald-50/80"
                  : "border-[#0F52BA]/5 bg-[#F6F9FF]/80",
            )}
          >
            {meta.actions}
          </div>
        )}

        <main className="cpae-main-surface relative min-w-0 flex-1 overflow-hidden">
          <div className="cpae-content-panel relative min-h-full">
            <div className="cpae-wave-bg" aria-hidden />
            <div className="relative z-10 p-4 sm:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>

      {user?.id && (
        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={(open) => {
            if (!open && mustChangePassword) return;
            setChangePasswordOpen(open);
          }}
          required={mustChangePassword}
          userId={user.id}
          onSuccess={() => setMustChangePassword(false)}
        />
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { setMeta } = usePageHeaderContext();

  useLayoutEffect(() => {
    setMeta({ title, description, actions });
    return () => setMeta({});
  }, [title, description, actions, setMeta]);

  return null;
}

export { ChevronDown };
