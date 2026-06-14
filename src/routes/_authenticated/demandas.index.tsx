import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { toast } from "sonner";
import { Eye, Loader2, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas/")({ component: Demandas });

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
  const [deleteTarget, setDeleteTarget] = useState<Req | null>(null);

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

  const colSpan = 10;

  return (
    <div>
      <PageHeader title="Demandas" description="Acompanhamento das solicitações de acolhimento." />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, aluno ou escola…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(requestStatusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
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
                {!isLoading && filtered.length === 0 && (<tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhuma demanda encontrada.</td></tr>)}
                {filtered.map((r) => (
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
            {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhuma demanda.</div>}
            {filtered.map((r) => (
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
