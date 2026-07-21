import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useLayoutEffect, type ReactNode } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeaderProvider, usePageHeaderContext } from "@/components/layout/page-header-context";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  admin?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  admin?: boolean;
  basePath: string;
  children: NavItem[];
}

const ACO_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/demandas", label: "Demandas", icon: Inbox },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/aprovacoes", label: "Aprovações", icon: CheckSquare, admin: true },
  { to: "/escolas", label: "Escolas", icon: School, admin: true },
  { to: "/profissionais", label: "Profissionais", icon: Users, admin: true },
];

const VIV_NAV: NavItem[] = [
  { to: "/modulo-vivencias/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/modulo-vivencias/demandas", label: "Demandas", icon: Inbox },
  { to: "/modulo-vivencias/agenda", label: "Agenda", icon: Calendar },
  { to: "/escolas", label: "Escolas", icon: School, admin: true },
  { to: "/profissionais", label: "Profissionais", icon: Users, admin: true },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Configurações",
    icon: Settings,
    admin: true,
    basePath: "/configuracoes",
    children: [{ to: "/configuracoes/usuarios", label: "Usuários", icon: UserCog }],
  },
];

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
  const { isAdmin, user, signOut, canAccessAcolhimento, canAccessVivencias } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isVivencias = pathname.startsWith("/modulo-vivencias");

  const items = (isVivencias ? VIV_NAV : ACO_NAV).filter((i) => !i.admin || isAdmin);
  const groups = NAV_GROUPS.filter((g) => !g.admin || isAdmin);
  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith("/configuracoes"));

  const showModuleSwitcher = canAccessAcolhimento && canAccessVivencias;
  const homeTo = canAccessAcolhimento
    ? "/dashboard"
    : canAccessVivencias
      ? "/modulo-vivencias/dashboard"
      : "/dashboard";

  const userName = displayName(user?.email, user?.user_metadata);
  const userInitials = userName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const linkClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? isVivencias
          ? "bg-emerald-500/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-gradient-to-b before:from-[#6EE7B7] before:via-[#10B981] before:to-[#047857]"
          : "bg-[#0F52BA]/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-gradient-to-b before:from-[#D633C6] before:via-[#0F52BA] before:to-[#52C41A]"
        : "text-[#CBD5E1] hover:bg-white/8 hover:text-white",
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl py-2 pl-10 pr-3 text-sm transition-all duration-200",
      active
        ? isVivencias
          ? "bg-emerald-500/25 font-medium text-white"
          : "bg-[#0F52BA]/30 font-medium text-white"
        : "text-[#94A3B8] hover:bg-white/8 hover:text-[#E2E8F0]",
    );

  const accentMuted = isVivencias ? "text-emerald-200/70" : "text-[#93C5FD]/55";
  const accentSoft = isVivencias ? "text-emerald-200/80" : "text-[#93C5FD]/80";
  const activeIcon = isVivencias ? "text-emerald-300" : "text-[#7DD3FC]";
  const moduleActiveBg = isVivencias ? "bg-emerald-600 text-white" : "bg-[#0F52BA] text-white";
  const moduleInactive = "text-[#94A3B8] hover:bg-white/10 hover:text-white";

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
                {isVivencias ? "Módulo Vivências" : "Hub de Sistemas"}
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

        <div className="relative space-y-2 px-3 pb-2 pt-3">
          <div className={cn("px-2 text-[10px] font-semibold uppercase tracking-[0.14em]", accentMuted)}>
            Módulo
          </div>
          {showModuleSwitcher ? (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors",
                  !isVivencias ? "bg-[#0F52BA] text-white" : moduleInactive,
                )}
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                Acolhimento
              </Link>
              <Link
                to="/modulo-vivencias/dashboard"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors",
                  isVivencias ? moduleActiveBg : moduleInactive,
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Vivências
              </Link>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold text-white",
                isVivencias || (canAccessVivencias && !canAccessAcolhimento)
                  ? "bg-emerald-600/45"
                  : "bg-[#0F52BA]/35",
              )}
            >
              {canAccessVivencias && !canAccessAcolhimento ? (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Vivências
                </>
              ) : (
                <>
                  <HeartHandshake className="h-3.5 w-3.5" />
                  Acolhimento
                </>
              )}
            </div>
          )}
        </div>

        <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 pt-1">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={linkClass(active)}
              >
                <it.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? activeIcon : "text-[#94A3B8]",
                  )}
                />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}

          {groups.map((group) => {
            const groupActive = pathname.startsWith(group.basePath);
            const expanded = settingsOpen || groupActive;

            return (
              <div key={group.basePath} className="pt-1">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={cn(linkClass(groupActive), "w-full justify-between")}
                  aria-expanded={expanded}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <group.icon className="h-[18px] w-[18px] shrink-0" />
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
                    {group.children.map((child) => {
                      const active = pathname === child.to || pathname.startsWith(child.to + "/");
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setOpen(false)}
                          className={subLinkClass(active)}
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
          )}
          aria-hidden
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "cpae-app-header sticky top-0 z-20 relative flex min-h-[72px] items-center gap-3 px-4 py-3 backdrop-blur-md lg:px-6",
            isVivencias && "cpae-app-header--vivencias",
          )}
        >
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className={cn(
              "shrink-0 rounded-xl p-2 transition-colors hover:bg-white/70 lg:hidden",
              isVivencias ? "text-emerald-700" : "text-[#0F52BA]",
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
                      isVivencias ? "bg-emerald-500" : "bg-[#F7B500]",
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

            <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/75 py-1.5 pl-1.5 pr-2 shadow-sm backdrop-blur-sm sm:gap-3 sm:pr-3">
              <div
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white",
                  isVivencias
                    ? "bg-gradient-to-br from-emerald-500 to-teal-700"
                    : "bg-gradient-to-br from-[#0F52BA] to-[#7B2CBF]",
                )}
              >
                {userInitials}
              </div>
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-sm font-semibold text-[#0F172A]">{userName}</div>
                <div className="text-[11px] text-[#64748B]">
                  {isAdmin ? "Coordenador" : "Profissional"}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 shrink-0 gap-1.5 rounded-xl px-2.5 sm:px-3",
                  isVivencias
                    ? "text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-900"
                    : "text-[#0F52BA] hover:bg-[#0F52BA]/10 hover:text-[#0A3D8C]",
                )}
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </header>

        {meta.actions && (
          <div
            className={cn(
              "flex justify-end border-b px-4 py-2 sm:hidden",
              isVivencias
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
