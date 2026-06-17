import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface PageHeaderMeta {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

interface PageHeaderContextValue {
  meta: PageHeaderMeta;
  setMeta: (meta: PageHeaderMeta) => void;
}

const PageHeaderCtx = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<PageHeaderMeta>({});
  const setMeta = useCallback((next: PageHeaderMeta) => setMetaState(next), []);

  return <PageHeaderCtx.Provider value={{ meta, setMeta }}>{children}</PageHeaderCtx.Provider>;
}

export function usePageHeaderContext() {
  const ctx = useContext(PageHeaderCtx);
  if (!ctx) throw new Error("usePageHeaderContext must be used within PageHeaderProvider");
  return ctx;
}
