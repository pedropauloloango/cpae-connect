import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import {
  VIVENCIAS_DEMANDAS_FILTROS,
  VIVENCIAS_EM_ATENDIMENTO_STATUSES,
  vivenciasDemandasFiltroLabels,
  type VivenciasDemandasFiltro,
} from "@/lib/vivencias-demandas-filtros";
import { exportVivenciasDemandasToExcel } from "@/lib/vivencias-demandas-export";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FileSpreadsheet,
  Loader2,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { periodoLabels, regiaoEscolaLabel } from "@/lib/acolhimento-options";
import { palestraTemaLabel } from "@/lib/vivencias-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/demandas/")({
  validateSearch: (search: Record<string, unknown>) => ({
    filtro:
      typeof search.filtro === "string" && search.filtro.trim().length > 0
        ? search.filtro.trim()
        : undefined,
  }),
  component: VivenciasDemandas,
});

const PAGE_SIZE = 15;

type SortKey =
  | "numero"
  | "escola"
  | "tipo"
  | "data_vivencia"
  | "periodo"
  | "turmas"
  | "profissionais"
  | "status"
  | "recebida";

type SortDir = "asc" | "desc";

interface VivReq {
  id: string;
  numero: string;
  status: string;
  created_at: string;
  school_nome_snapshot: string | null;
  regiao_escola: string | null;
  palestra_tema: string | null;
  data_preferivel_vivencia: string | null;
  data_preferivel_palestra: string | null;
  school: { regiao: string | null } | null;
  groups: { aluno_serie: string; aluno_turma: string; periodo: string; data_preferivel: string | null }[] | null;
  palestras: { aluno_serie: string; aluno_turma: string; periodo: string; palestra_tema: string; data_preferivel: string | null }[] | null;
  assignees: { professional: { nome: string } | null }[] | null;
}

function formatDateBr(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

function requestTipo(r: VivReq): string {
  const hasGroups = (r.groups?.length ?? 0) > 0;
  const hasPalestra = (r.palestras?.length ?? 0) > 0 || Boolean(r.palestra_tema?.trim());
  if (hasGroups && hasPalestra) return "Vivência e palestra";
  if (hasPalestra) return "Palestra";
  if (hasGroups) return "Vivência";
  return "—";
}

function requestDatasVivencia(r: VivReq): string {
  const fromGroups = [
    ...new Set(
      (r.groups ?? [])
        .map((g) => formatDateBr(g.data_preferivel))
        .filter((d): d is string => Boolean(d)),
    ),
  ];
  if (fromGroups.length > 0) return fromGroups.join(", ");

  const fromPalestras = [
    ...new Set(
      (r.palestras ?? [])
        .map((p) => formatDateBr(p.data_preferivel))
        .filter((d): d is string => Boolean(d)),
    ),
  ];
  if (fromPalestras.length > 0) return fromPalestras.join(", ");

  const fromRequest = formatDateBr(r.data_preferivel_vivencia);
  if (fromRequest) return fromRequest;

  if (r.palestra_tema) {
    const palestra = formatDateBr(r.data_preferivel_palestra);
    if (palestra) return palestra;
  }
  return "—";
}

/** ISO date for sorting (earliest group/request date). */
function requestDataVivenciaSortKey(r: VivReq): string {
  const fromGroups = (r.groups ?? [])
    .map((g) => g.data_preferivel)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (fromGroups[0]) return fromGroups[0];
  const fromPalestras = (r.palestras ?? [])
    .map((p) => p.data_preferivel)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (fromPalestras[0]) return fromPalestras[0];
  if (r.data_preferivel_vivencia) return r.data_preferivel_vivencia;
  if (r.palestra_tema && r.data_preferivel_palestra) return r.data_preferivel_palestra;
  return "";
}

function requestPeriodos(r: VivReq): string {
  const periodos = [
    ...new Set(
      [...(r.groups ?? []), ...(r.palestras ?? [])]
        .map((g) => periodoLabels[g.periodo] ?? g.periodo)
        .filter(Boolean),
    ),
  ];
  return periodos.length > 0 ? periodos.join(", ") : "—";
}

function requestTurmas(r: VivReq): string {
  const fromGroups = r.groups?.map((g) => `${g.aluno_serie} ${g.aluno_turma}`).join(", ");
  const fromPalestras = r.palestras
    ?.map((p) => `${p.aluno_serie} ${p.aluno_turma} · ${palestraTemaLabel(p.palestra_tema)}`)
    .join(", ");
  return (
    fromGroups ||
    fromPalestras ||
    (r.palestra_tema ? `Palestra: ${palestraTemaLabel(r.palestra_tema)}` : "—")
  );
}

function requestProfissionaisNomes(r: VivReq): string[] {
  return (
    r.assignees
      ?.map((a) => a.professional?.nome)
      .filter((n): n is string => Boolean(n)) ?? []
  );
}

function requestProfissionais(r: VivReq): string {
  const nomes = requestProfissionaisNomes(r);
  return nomes.length > 0 ? nomes.join(", ") : "—";
}

const professionalTonePalette = [
  "bg-info/10 text-info border-info/20",
  "bg-primary/10 text-primary border-primary/20",
  "bg-success/10 text-success border-success/20",
  "bg-orange-500/10 text-orange-700 border-orange-500/25 dark:text-orange-400",
  "bg-accent/10 text-accent border-accent/20",
  "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-400",
  "bg-teal-500/10 text-teal-700 border-teal-500/25 dark:text-teal-400",
  "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400",
] as const;

function professionalTone(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  }
  return professionalTonePalette[hash % professionalTonePalette.length];
}

function sortValue(r: VivReq, key: SortKey): string {
  switch (key) {
    case "numero":
      return r.numero ?? "";
    case "escola":
      return (r.school_nome_snapshot ?? "").toLowerCase();
    case "tipo":
      return requestTipo(r).toLowerCase();
    case "data_vivencia":
      return requestDataVivenciaSortKey(r);
    case "periodo":
      return requestPeriodos(r).toLowerCase();
    case "turmas":
      return requestTurmas(r).toLowerCase();
    case "profissionais":
      return requestProfissionais(r).toLowerCase();
    case "status":
      return (requestStatusLabels[r.status] ?? r.status).toLowerCase();
    case "recebida":
      return r.created_at ?? "";
    default:
      return "";
  }
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
    </th>
  );
}

function VivenciasDemandas() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/_authenticated/modulo-vivencias/demandas/" });
  const { filtro: filtroSearch } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(filtroSearch ?? "todos");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<VivReq | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("recebida");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setStatus(filtroSearch ?? "todos");
  }, [filtroSearch]);

  const applyFilter = (value: string) => {
    setStatus(value);
    setPage(1);
    void navigate({
      search: { filtro: value === "todos" ? undefined : value },
      replace: true,
    });
  };

  const { data: myProfId } = useQuery({
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

  const { data: myRequestIds = [] } = useQuery({
    queryKey: ["viv-dash-my-request-ids", myProfId],
    enabled: !isAdmin && !!myProfId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_request_assignees")
        .select("vivencia_request_id")
        .eq("professional_id", myProfId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.vivencia_request_id);
    },
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["vivencias-demandas", status, isAdmin, myRequestIds],
    enabled: isAdmin || myProfId !== undefined,
    queryFn: async () => {
      let requestIdsFromReports: string[] | null = null;

      if (status === "relatorios_validar") {
        let reportsQ = supabase.from("vivencia_reports").select("vivencia_request_id");
        if (isAdmin) {
          reportsQ = reportsQ.eq("status", "aguardando_aprovacao");
        } else {
          if (!myProfId || myRequestIds.length === 0) return [];
          reportsQ = reportsQ
            .in("vivencia_request_id", myRequestIds)
            .in("status", ["correcao_solicitada", "rejeitado", "rascunho"]);
        }
        const { data: reports, error: reportsErr } = await reportsQ;
        if (reportsErr) throw reportsErr;
        requestIdsFromReports = [
          ...new Set(
            (reports ?? [])
              .map((r) => r.vivencia_request_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        if (requestIdsFromReports.length === 0) return [];
      }

      let qb = supabase
        .from("vivencia_requests")
        .select(
          "id, numero, status, created_at, school_nome_snapshot, regiao_escola, palestra_tema, data_preferivel_vivencia, data_preferivel_palestra, school:schools(regiao), groups:vivencia_request_groups(aluno_serie, aluno_turma, periodo, data_preferivel), palestras:vivencia_request_palestras(aluno_serie, aluno_turma, periodo, palestra_tema, data_preferivel), assignees:vivencia_request_assignees(professional:professionals(nome))",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (status === "em_atendimento") {
        qb = qb.in("status", [...VIVENCIAS_EM_ATENDIMENTO_STATUSES]);
      } else if (status === "relatorios_validar" && requestIdsFromReports) {
        qb = qb.in("id", requestIdsFromReports);
      } else if (status !== "todos") {
        qb = qb.eq("status", status as "recebida");
      }

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "recebida" || key === "data_vivencia" ? "desc" : "asc");
    }
    setPage(1);
  };

  const filtered = list.filter((r) => {
    if (!q.trim()) return true;
    const hay = [
      r.numero,
      r.school_nome_snapshot,
      r.palestra_tema,
      ...(r.palestras?.map((p) => p.palestra_tema) ?? []),
      requestTipo(r),
      requestDatasVivencia(r),
      requestPeriodos(r),
      ...(r.assignees?.map((a) => a.professional?.nome) ?? []),
      ...(r.groups?.map((g) => `${g.aluno_serie} ${g.aluno_turma}`) ?? []),
      ...(r.palestras?.map((p) => `${p.aluno_serie} ${p.aluno_turma}`) ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  useEffect(() => setPage(1), [q, status]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = totalFiltered === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + PAGE_SIZE, totalFiltered);

  const activeFiltroLabel =
    status !== "todos" && (VIVENCIAS_DEMANDAS_FILTROS as readonly string[]).includes(status)
      ? vivenciasDemandasFiltroLabels[status as VivenciasDemandasFiltro]
      : status !== "todos"
        ? (requestStatusLabels[status] ?? status)
        : null;

  const handleExportExcel = () => {
    if (sorted.length === 0) {
      toast.error("Nenhuma demanda para exportar.");
      return;
    }
    try {
      exportVivenciasDemandasToExcel(
        sorted.map((r) => ({
          Protocolo: r.numero,
          Escola: r.school_nome_snapshot ?? "",
          Região: regiaoEscolaLabel(r.regiao_escola ?? r.school?.regiao),
          Tipo: requestTipo(r),
          "Data vivência": requestDatasVivencia(r),
          Período: requestPeriodos(r),
          Turmas: requestTurmas(r),
          Profissionais: requestProfissionais(r),
          Status: requestStatusLabels[r.status] ?? r.status,
          Recebida: new Date(r.created_at).toLocaleDateString("pt-BR"),
        })),
      );
      toast.success(
        sorted.length === 1
          ? "1 demanda exportada para Excel."
          : `${sorted.length} demandas exportadas para Excel.`,
      );
    } catch (e) {
      toast.error("Erro ao exportar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandas — Vivências"
        description={
          activeFiltroLabel
            ? `Filtro: ${activeFiltroLabel}.`
            : "Solicitações de vivências e palestras enviadas pelas escolas"
        }
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
          <Select value={status} onValueChange={applyFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_atendimento">
                {vivenciasDemandasFiltroLabels.em_atendimento}
              </SelectItem>
              <SelectItem value="relatorios_validar">
                {isAdmin
                  ? vivenciasDemandasFiltroLabels.relatorios_validar
                  : "Meus relatórios"}
              </SelectItem>
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
          <div className="flex justify-end px-4 pb-1 pt-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-green-700/40 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={handleExportExcel}
              disabled={isLoading || sorted.length === 0}
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : pageItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Nenhuma solicitação encontrada.</div>
          ) : (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-slate-50/80 text-xs tracking-wide">
                <tr>
                  <SortHeader label="Protocolo" column="numero" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Escola" column="escola" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Tipo" column="tipo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Data vivência" column="data_vivencia" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Período" column="periodo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Turmas" column="turmas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Profissionais" column="profissionais" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Recebida" column="recebida" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 font-semibold uppercase text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => {
                  const turmas = requestTurmas(r);
                  const prosNomes = requestProfissionaisNomes(r);
                  const tipo = requestTipo(r);
                  const datas = requestDatasVivencia(r);
                  const periodos = requestPeriodos(r);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F52BA]">{r.numero}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.school_nome_snapshot ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {regiaoEscolaLabel(r.regiao_escola ?? r.school?.regiao)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{tipo}</td>
                      <td className="px-4 py-3 whitespace-nowrap" title={datas}>
                        {datas}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3" title={periodos}>
                        {periodos}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3" title={turmas}>
                        {turmas}
                      </td>
                      <td className="max-w-[200px] px-4 py-3" title={prosNomes.join(", ") || undefined}>
                        {prosNomes.length === 0 ? (
                          "—"
                        ) : (
                          <div
                            className={cn(
                              "flex flex-col gap-1",
                              prosNomes.length > 1 ? "text-xs" : "text-sm",
                            )}
                          >
                            {prosNomes.map((nome, i) => (
                              <Badge
                                key={`${nome}-${i}`}
                                variant="secondary"
                                className={cn(
                                  "w-fit max-w-full truncate border font-normal",
                                  prosNomes.length > 1 && "text-[11px] px-1.5 py-0",
                                  professionalTone(nome),
                                )}
                              >
                                {nome}
                              </Badge>
                            ))}
                          </div>
                        )}
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
              <span className="text-muted-foreground">
                {" "}
                {totalFiltered === 1 ? "demanda" : "demandas"}
              </span>
              {totalFiltered > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exibindo {showingFrom}–{showingTo}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
