import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { requestStatusLabels, requestStatusTone } from "@/lib/labels";
import {
  DEMANDAS_FILTROS,
  EM_ATENDIMENTO_STATUSES,
  demandasFiltroLabels,
  fetchRequestIdsComAtendimentoNoMes,
  type DemandasFiltro,
} from "@/lib/demandas-filtros";
import { exportDemandasToExcel } from "@/lib/demandas-export";
import {
  formatRequestQueixas,
  situacaoObservadaChartLabel,
  situacaoObservadaOptions,
  situacoesFromRequest,
} from "@/lib/acolhimento-options";
import { PENDING_RECEIVED_REQUESTS_QUERY_KEY } from "@/lib/pending-approvals";
import { toast } from "sonner";
import { Eye, Loader2, Trash2, ChevronLeft, ChevronRight, FilterX, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas/")({
  validateSearch: (search: Record<string, unknown>) => ({
    filtro:
      typeof search.filtro === "string" && search.filtro.trim().length > 0
        ? search.filtro.trim()
        : undefined,
    queixa:
      typeof search.queixa === "string" && search.queixa.trim().length > 0
        ? search.queixa.trim()
        : undefined,
  }),
  component: Demandas,
});

const PAGE_SIZE = 15;

interface Req {
  id: string;
  numero: string;
  aluno_nome: string;
  tipo_queixa: string | null;
  situacao_observada: string[] | null;
  status: string;
  created_at: string;
  school_nome_snapshot: string | null;
  school: { regiao: string | null } | null;
  professional: { nome: string } | null;
  meetings: { status: string }[] | null;
}

const QUEIXA_FILTER_OPTIONS = [
  ...situacaoObservadaOptions.map((o) => ({
    value: o.value,
    label: situacaoObservadaChartLabel(o.value),
  })),
  { value: "ansiedade_depressao", label: situacaoObservadaChartLabel("ansiedade_depressao") },
];

function Demandas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { filtro: filtroSearch, queixa: queixaSearch } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const [aluno, setAluno] = useState("");
  const [escola, setEscola] = useState("");
  const [profissional, setProfissional] = useState("todos");
  const [mesSolicitacao, setMesSolicitacao] = useState("");
  const [queixa, setQueixa] = useState(queixaSearch ?? "todos");
  const [status, setStatus] = useState<string>(filtroSearch ?? "todos");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Req | null>(null);

  useEffect(() => {
    setStatus(filtroSearch ?? "todos");
  }, [filtroSearch]);

  useEffect(() => {
    setQueixa(queixaSearch ?? "todos");
  }, [queixaSearch]);

  const demandasSearch = (next: { status?: string; queixa?: string }) => {
    const nextStatus = next.status ?? status;
    const nextQueixa = next.queixa ?? queixa;
    return {
      filtro: nextStatus === "todos" ? undefined : nextStatus,
      queixa: nextQueixa === "todos" ? undefined : nextQueixa,
    };
  };

  const applyStatusFilter = (value: string) => {
    setStatus(value);
    setPage(1);
    void navigate({
      to: "/demandas",
      search: demandasSearch({ status: value }),
      replace: true,
    });
  };

  const applyQueixaFilter = (value: string) => {
    setQueixa(value);
    setPage(1);
    void navigate({
      to: "/demandas",
      search: demandasSearch({ queixa: value }),
      replace: true,
    });
  };

  const clearFilters = () => {
    setAluno("");
    setEscola("");
    setProfissional("todos");
    setMesSolicitacao("");
    setQueixa("todos");
    setStatus("todos");
    setPage(1);
    void navigate({
      to: "/demandas",
      search: { filtro: undefined, queixa: undefined },
      replace: true,
    });
  };

  const hasActiveFilters =
    aluno.trim().length > 0 ||
    escola.trim().length > 0 ||
    profissional !== "todos" ||
    mesSolicitacao.length > 0 ||
    queixa !== "todos" ||
    status !== "todos";

  const { data: myProfId, isLoading: loadingMyProf } = useQuery({
    queryKey: ["my-pro", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user && !isAdmin,
  });

  const { data: availableStatuses = [], isLoading: loadingStatuses } = useQuery({
    queryKey: ["demandas-status-options", isAdmin, myProfId],
    enabled: isAdmin || myProfId !== undefined,
    queryFn: async () => {
      let qb = supabase.from("requests").select("status").is("deleted_at", null);
      if (!isAdmin) {
        if (!myProfId) return [];
        qb = qb.eq("assigned_professional_id", myProfId);
      }
      const { data, error } = await qb;
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

  const { data: professionals = [] } = useQuery({
    queryKey: ["demandas-professional-options", isAdmin, myProfId],
    enabled: isAdmin || myProfId !== undefined,
    queryFn: async () => {
      let qb = supabase
        .from("professionals")
        .select("id, nome")
        .eq("atende_acolhimento", true)
        .is("deleted_at", null)
        .order("nome");
      if (!isAdmin) {
        if (!myProfId) return [];
        qb = qb.eq("id", myProfId);
      }
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: monthOptions = [] } = useQuery({
    queryKey: ["demandas-month-options", isAdmin, myProfId],
    enabled: isAdmin || myProfId !== undefined,
    queryFn: async () => {
      let qb = supabase
        .from("requests")
        .select("created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!isAdmin) {
        if (!myProfId) return [];
        qb = qb.eq("assigned_professional_id", myProfId);
      }
      const { data, error } = await qb;
      if (error) throw error;

      const keys = new Set<string>();
      for (const row of data ?? []) {
        const d = new Date(row.created_at);
        keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      return [...keys]
        .sort()
        .reverse()
        .map((key) => {
          const [y, m] = key.split("-").map(Number);
          const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          });
          return { value: key, label: label.charAt(0).toUpperCase() + label.slice(1) };
        });
    },
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["demandas", status, mesSolicitacao, isAdmin, myProfId],
    enabled: isAdmin || (!loadingMyProf && myProfId !== undefined),
    queryFn: async () => {
      if (!isAdmin && !myProfId) return [];

      let requestIdsForMonth: string[] | null = null;
      if (status === "atendimentos_mes") {
        requestIdsForMonth = await fetchRequestIdsComAtendimentoNoMes(
          isAdmin ? null : myProfId,
        );
        if (requestIdsForMonth.length === 0) return [];
      }

      let qb = supabase
        .from("requests")
        .select(
          "id, numero, aluno_nome, tipo_queixa, situacao_observada, status, created_at, school_nome_snapshot, school:schools(regiao), professional:professionals!assigned_professional_id(nome), meetings(status)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!isAdmin && myProfId) qb = qb.eq("assigned_professional_id", myProfId);

      if (mesSolicitacao) {
        const [y, m] = mesSolicitacao.split("-").map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 1, 0, 0, 0, 0);
        qb = qb.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
      }

      if (status === "em_atendimento") {
        qb = qb.in("status", [...EM_ATENDIMENTO_STATUSES]);
      } else if (status === "atendimentos_mes" && requestIdsForMonth) {
        qb = qb.in("id", requestIdsForMonth);
      } else if (status !== "todos") {
        qb = qb.eq("status", status as "recebida");
      }

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

  useEffect(() => {
    setPage(1);
  }, [aluno, escola, profissional, mesSolicitacao, queixa]);

  const filtered = list.filter((r) => {
    const alunoQ = aluno.trim().toLowerCase();
    if (alunoQ && !r.aluno_nome.toLowerCase().includes(alunoQ)) return false;

    const escolaQ = escola.trim().toLowerCase();
    if (escolaQ && !(r.school_nome_snapshot ?? "").toLowerCase().includes(escolaQ)) return false;

    if (profissional !== "todos") {
      const nome = r.professional?.nome ?? "";
      if (profissional === "sem_profissional") {
        if (nome) return false;
      } else if (nome !== profissional) {
        return false;
      }
    }

    if (queixa !== "todos" && !situacoesFromRequest(r).includes(queixa)) return false;

    return true;
  });

  useEffect(() => {
    if (status === "todos") return;
    if ((DEMANDAS_FILTROS as readonly string[]).includes(status)) return;
    if (availableStatuses.length > 0 && !availableStatuses.includes(status)) {
      setStatus("todos");
      void navigate({
        to: "/demandas",
        search: (prev) => ({
          filtro: undefined,
          queixa: prev.queixa,
        }),
        replace: true,
      });
    }
  }, [status, availableStatuses, navigate]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = totalFiltered === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + PAGE_SIZE, totalFiltered);

  const listLoading = isLoading || (!isAdmin && loadingMyProf);
  const colSpan = 10;
  const activeFiltroLabel =
    status !== "todos" && (DEMANDAS_FILTROS as readonly string[]).includes(status)
      ? demandasFiltroLabels[status as DemandasFiltro]
      : status !== "todos"
        ? (requestStatusLabels[status] ?? status)
        : null;
  const activeQueixaLabel = queixa !== "todos" ? situacaoObservadaChartLabel(queixa) : null;
  const activeFiltroParts = [activeFiltroLabel, activeQueixaLabel ? `Queixa: ${activeQueixaLabel}` : null].filter(
    Boolean,
  );

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error("Nenhuma demanda para exportar.");
      return;
    }
    try {
      exportDemandasToExcel(filtered);
      toast.success(
        filtered.length === 1
          ? "1 demanda exportada para Excel."
          : `${filtered.length} demandas exportadas para Excel.`,
      );
    } catch (e) {
      toast.error("Erro ao exportar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Demandas"
        description={
          activeFiltroParts.length > 0
            ? `Filtro: ${activeFiltroParts.join(" · ")}.`
            : isAdmin
              ? "Acompanhamento das solicitações de acolhimento."
              : "Suas solicitações de acolhimento atribuídas."
        }
      />

      <Card className="cpae-card mb-4 border-0 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={aluno}
            onChange={(e) => setAluno(e.target.value)}
            placeholder="Aluno"
            className="sm:min-w-0 sm:flex-1"
          />
          <Input
            value={escola}
            onChange={(e) => setEscola(e.target.value)}
            placeholder="Escola"
            className="sm:min-w-0 sm:flex-1"
          />
          <Select value={profissional} onValueChange={setProfissional}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os profissionais</SelectItem>
              <SelectItem value="sem_profissional">Sem profissional</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.nome}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={mesSolicitacao || "todos"}
            onValueChange={(v) => setMesSolicitacao(v === "todos" ? "" : v)}
          >
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Mês da solicitação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {mesSolicitacao &&
                !monthOptions.some((o) => o.value === mesSolicitacao) && (
                  <SelectItem value={mesSolicitacao}>
                    {(() => {
                      const [y, m] = mesSolicitacao.split("-").map(Number);
                      const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      });
                      return label.charAt(0).toUpperCase() + label.slice(1);
                    })()}
                  </SelectItem>
                )}
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={queixa} onValueChange={applyQueixaFilter}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Queixa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as queixas</SelectItem>
              {QUEIXA_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={applyStatusFilter} disabled={loadingStatuses}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_atendimento">{demandasFiltroLabels.em_atendimento}</SelectItem>
              <SelectItem value="atendimentos_mes">{demandasFiltroLabels.atendimentos_mes}</SelectItem>
              {availableStatuses.map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {requestStatusLabels[statusValue] ?? statusValue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            title="Limpar filtros"
          >
            <FilterX className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="p-0">
          <div className="flex justify-end px-4 pb-1 pt-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-green-700/40 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={handleExportExcel}
              disabled={listLoading || totalFiltered === 0}
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </div>

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
                  <th className="px-4 py-3">Criado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listLoading && (<tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>)}
                {!listLoading && paginated.length === 0 && (<tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhuma demanda encontrada.</td></tr>)}
                {paginated.map((r) => {
                  const queixas = formatRequestQueixas(r);
                  return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{r.numero}</td>
                    <td className="px-4 py-3 font-medium">{r.aluno_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school_nome_snapshot ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school?.regiao ?? "—"}</td>
                    <td className="max-w-[220px] px-4 py-3" title={queixas || undefined}>
                      {queixas || "—"}
                    </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {listLoading && <div className="p-6 text-center text-muted-foreground">Carregando…</div>}
            {!listLoading && paginated.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhuma demanda.</div>}
            {paginated.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{r.numero}</span>
                  <Badge variant="outline" className={requestStatusTone[r.status]}>{requestStatusLabels[r.status]}</Badge>
                </div>
                <div className="mt-1 font-medium">{r.aluno_nome}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{r.school_nome_snapshot ?? "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatRequestQueixas(r) || "—"} • Criado{" "}
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
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
                disabled={currentPage <= 1 || totalFiltered === 0 || listLoading}
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
                disabled={currentPage >= totalPages || totalFiltered === 0 || listLoading}
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
