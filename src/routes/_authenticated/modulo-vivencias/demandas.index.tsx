import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { requestStatusLabels, requestStatusTone } from "@/lib/labels";
import { toast } from "sonner";
import { Eye, Loader2, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { regiaoEscolaLabel } from "@/lib/acolhimento-options";
import { palestraTemaLabel } from "@/lib/vivencias-options";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/demandas/")({
  component: VivenciasDemandas,
});

const PAGE_SIZE = 15;

interface VivReq {
  id: string;
  numero: string;
  status: string;
  created_at: string;
  school_nome_snapshot: string | null;
  regiao_escola: string | null;
  palestra_tema: string | null;
  school: { regiao: string | null } | null;
  groups: { aluno_serie: string; aluno_turma: string; periodo: string }[] | null;
  assignees: { professional: { nome: string } | null }[] | null;
}

function VivenciasDemandas() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<VivReq | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["vivencias-demandas", status],
    queryFn: async () => {
      let qb = supabase
        .from("vivencia_requests")
        .select(
          "id, numero, status, created_at, school_nome_snapshot, regiao_escola, palestra_tema, school:schools(regiao), groups:vivencia_request_groups(aluno_serie, aluno_turma, periodo), assignees:vivencia_request_assignees(professional:professionals(nome))",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "todos") qb = qb.eq("status", status as "recebida");
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as VivReq[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("vivencia_requests")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação excluída.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["vivencias-demandas"] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const filtered = list.filter((r) => {
    if (!q.trim()) return true;
    const hay = [
      r.numero,
      r.school_nome_snapshot,
      r.palestra_tema,
      ...(r.assignees?.map((a) => a.professional?.nome) ?? []),
      ...(r.groups?.map((g) => `${g.aluno_serie} ${g.aluno_turma}`) ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  useEffect(() => setPage(1), [q, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandas — Vivências"
        description="Solicitações de vivências e palestras enviadas pelas escolas"
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por protocolo, escola, turma..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(requestStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : pageItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Nenhuma solicitação encontrada.</div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50/80 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Protocolo</th>
                  <th className="px-4 py-3 font-semibold">Escola</th>
                  <th className="px-4 py-3 font-semibold">Turmas</th>
                  <th className="px-4 py-3 font-semibold">Profissionais</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Recebida</th>
                  <th className="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => {
                  const turmas =
                    r.groups?.map((g) => `${g.aluno_serie} ${g.aluno_turma}`).join(", ") ||
                    (r.palestra_tema ? `Palestra: ${palestraTemaLabel(r.palestra_tema)}` : "—");
                  const pros =
                    r.assignees
                      ?.map((a) => a.professional?.nome)
                      .filter(Boolean)
                      .join(", ") || "—";
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F52BA]">{r.numero}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.school_nome_snapshot ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {regiaoEscolaLabel(r.regiao_escola ?? r.school?.regiao)}
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3" title={turmas}>
                        {turmas}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3" title={pros}>
                        {pros}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={requestStatusTone[r.status] ?? ""}>
                          {requestStatusLabels[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to="/modulo-vivencias/demandas/$id" params={{ id: r.id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação {deleteTarget?.numero} será marcada como excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
