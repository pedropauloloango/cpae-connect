/** Módulo ativo na UI (shell / notificações), inclusive em rotas compartilhadas. */

export type AppModule = "acolhimento" | "vivencias";

const STORAGE_KEY = "cpae-active-module";

const SHARED_PREFIXES = ["/escolas", "/profissionais", "/configuracoes"];

export function isSharedAdminPath(pathname: string): boolean {
  return SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function persistModule(module: AppModule): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, module);
  } catch {
    /* ignore */
  }
}

function readPersistedModule(): AppModule | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value === "vivencias" || value === "acolhimento") return value;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve o módulo visual a partir da rota.
 * Em Escolas / Profissionais / Configurações, mantém o módulo de onde o usuário veio.
 */
export function resolveActiveModule(pathname: string): AppModule {
  if (pathname.startsWith("/modulo-vivencias")) {
    persistModule("vivencias");
    return "vivencias";
  }

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/demandas") ||
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/aprovacoes")
  ) {
    persistModule("acolhimento");
    return "acolhimento";
  }

  if (isSharedAdminPath(pathname)) {
    return readPersistedModule() ?? "acolhimento";
  }

  return readPersistedModule() ?? "acolhimento";
}

export function isVivenciasModuleActive(pathname: string): boolean {
  return resolveActiveModule(pathname) === "vivencias";
}
