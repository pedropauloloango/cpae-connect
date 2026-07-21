import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_MODULES,
  DEFAULT_ADMIN_MODULES,
  fetchProfessionalModules,
  type ProfessionalModules,
} from "@/lib/professional-modules";

export type AppRole = "admin" | "profissional";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  /** Módulos habilitados no cadastro do profissional (admin tem os dois). */
  modules: ProfessionalModules;
  canAccessAcolhimento: boolean;
  canAccessVivencias: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [modules, setModules] = useState<ProfessionalModules>(EMPTY_MODULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => void loadAccess(s.user.id), 0);
      } else {
        setRoles([]);
        setModules(EMPTY_MODULES);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        void loadAccess(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAccess(userId: string) {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const nextRoles = (roleRows ?? []).map((r: { role: AppRole }) => r.role);
    setRoles(nextRoles);

    if (nextRoles.includes("admin")) {
      setModules(DEFAULT_ADMIN_MODULES);
      return;
    }

    try {
      const nextModules = await fetchProfessionalModules(userId);
      setModules(nextModules);
    } catch {
      setModules(EMPTY_MODULES);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]);
    setModules(EMPTY_MODULES);
  };

  const isAdmin = roles.includes("admin");
  const canAccessAcolhimento = isAdmin || modules.atendeAcolhimento;
  const canAccessVivencias = isAdmin || modules.atendeVivencias;

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isAdmin,
    modules,
    canAccessAcolhimento,
    canAccessVivencias,
    signOut,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
