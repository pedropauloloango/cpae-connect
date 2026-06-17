import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/AppShell";
import { MeetingCountIndicators } from "@/components/requests/MeetingCountIndicators";
import { complaintTypeLabels, requestStatusLabels, requestStatusTone } from "@/lib/labels";
import { PENDING_RECEIVED_REQUESTS_QUERY_KEY } from "@/lib/pending-approvals";
import { toast } from "sonner";
import { Eye, Loader2, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas/")({ component: Demandas });

const PAGE_SIZE = 15;

interface Req {
  id: string;
  numero: string;
  aluno_nome: string;
  tipo_queixa: string | null;
  status: string;
  created_at: string;
  school_nome_snapshot: string | null;
  school: { regiao: string | null } | null;
  professional: { nome: string } | null;
  meetings: { status: string }[] | null;
}

function Demandas() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Req | null>(null);

  const { data: availableStatuses = [], isLoading: loadingStatuses } = useQuery({
    queryKey: ["demandas-status-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("status").is("deleted_at", null);
      if (error) throw error;

      const unique = [...new Set((data ?? []).map((row) => row.status).filter(Boolean))];
      const order = Object.keys(requestStatusLabels);
      return unique.sort((a, b) => {
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b, "pt-BR");
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    },
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["demandas", status],
    queryFn: async () => {
      let qb = supabase
        .from("requests")
        .select(
          "id, numero, aluno_nome, tipo_queixa, status, created_at, school_nome_snapshot, school:schools(regiao), professional:professionals!assigned_professional_id(nome), meetings(status)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "todos") qb = qb.eq("status", status as "recebida");
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as Req[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("requests")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação excluída.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demandas-status-options"] });
      qc.invalidateQueries({ queryKey: PENDING_RECEIVED_REQUESTS_QUERY_KEY });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const filtered = list.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.numero.toLowerCase().includes(s) ||
      r.aluno_nome.toLowerCase().includes(s) ||
      (r.school_nome_snapshot ?? "").toLowerCase().includes(s)
    );
  });

  useEffect(() => {
    if (status !== "todos" && availableStatuses.length > 0 && !availableStatuses.includes(status)) {
      setStatus("todos");
    }
  }, [status, availableStatuses]);

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = totalFiltered === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + PAGE_SIZE, totalFiltered);

  const colSpan = 10;

  return (
    <div>
      <PageHeader title="Demandas" description="Acompanhamento das solicitações de acolhimento." />

      <Card className="cpae-card mb-4 border-0 shadow-none">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, aluno ou escola…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus} disabled={loadingStatuses}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {availableStatuses.map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {requestStatusLabels[statusValue] ?? statusValue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Escola</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3">Queixa</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3">Qtde de Encontros</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recebida</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && (<tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>)}
                {!isLoading && paginated.length === 0 && (<tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhuma demanda encontrada.</td></tr>)}
                {paginated.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{r.numero}</td>
                    <td className="px-4 py-3 font-medium">{r.aluno_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school_nome_snapshot ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school?.regiao ?? "—"}</td>
                    <td className="px-4 py-3">{r.tipo_queixa ? complaintTypeLabels[r.tipo_queixa] : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.professional?.nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <MeetingCountIndicators meetings={r.meetings} />
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className={requestStatusTone[r.status]}>{requestStatusLabels[r.status]}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                          <Link to="/demandas/$id" params={{ id: r.id }}>
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Link>
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                            title="Excluir solicitação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {isLoading && <div className="p-6 text-center text-muted-foreground">Carregando…</div>}
            {!isLoading && paginated.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhuma demanda.</div>}
            {paginated.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{r.numero}</span>
                  <Badge variant="outline" className={requestStatusTone[r.status]}>{requestStatusLabels[r.status]}</Badge>
                </div>
                <div className="mt-1 font-medium">{r.aluno_nome}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{r.school_nome_snapshot ?? "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.tipo_queixa ? complaintTypeLabels[r.tipo_queixa] : "—"} • {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </div>
                {r.professional?.nome && (
                  <div className="mt-1 text-xs text-muted-foreground">Profissional: {r.professional.nome}</div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Encontros:</span>
                  <MeetingCountIndicators meetings={r.meetings} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                    <Link to="/demandas/$id" params={{ id: r.id }}>
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Link>
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(r)}
                      title="Excluir solicitação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage <= 1 || totalFiltered === 0 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="min-w-[7rem] text-center text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage >= totalPages || totalFiltered === 0 || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center text-sm sm:ml-auto sm:text-right">
              <span className="font-semibold text-[#0F172A]">{totalFiltered}</span>
              <span className="text-muted-foreground"> {totalFiltered === 1 ? "demanda" : "demandas"}</span>
              {totalFiltered > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exibindo {showingFrom}–{showingTo}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A solicitação ${deleteTarget.numero} (${deleteTarget.aluno_nome}) será removida da listagem. Esta ação não pode ser desfeita pela interface.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
