import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Inbox, School, Users, Calendar, CheckSquare,
  LogOut, Menu, X, Heart, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; admin?: boolean; }

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/demandas", label: "Demandas", icon: Inbox },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/aprovacoes", label: "Aprovações", icon: CheckSquare, admin: true },
  { to: "/escolas", label: "Escolas", icon: School, admin: true },
  { to: "/profissionais", label: "Profissionais", icon: Users, admin: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isAdmin, user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((i) => !i.admin || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-sidebar-border px-5">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Heart className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Gestão CPAE</div>
              <div className="text-[11px] text-sidebar-foreground/60">HUB de sistemas</div>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Módulo Acolhimento
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <it.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-md bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {(user?.email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user?.email}</div>
                <div className="text-[11px] text-sidebar-foreground/60">{isAdmin ? "Administrador" : "Profissional"}</div>
              </div>
            </div>
            <Button onClick={handleSignOut} variant="ghost" className="mt-3 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-md p-2 hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="CPAE" className="h-7 w-7 rounded" />
            <span className="font-semibold">Gestão CPAE</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// Reusable page header
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export { ChevronDown };
