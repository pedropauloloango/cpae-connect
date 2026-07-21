import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requestStatusLabels, requestStatusTone } from "@/lib/labels";
import { buildVivenciaFormSections } from "@/lib/vivencias-form-display";
import {
  alunoSerieOptions,
  alunoTurmaOptions,
  periodoOptions,
  palestraTemaOptions,
  vivenciaTemaOptions,
} from "@/lib/vivencias-options";
import { alunoSerieLabels } from "@/lib/acolhimento-options";
import {
  collectVivenciaActivityLogLookupIds,
  formatVivenciaActivityLogDescription,
  vivenciaActivityLogTitle,
  type VivenciaActivityLogRow,
} from "@/lib/vivencia-activity-log-descriptions";
import { VivenciaRelatorioTab } from "@/components/vivencias/VivenciaRelatorioTab";
import { ClosureTabIndicator } from "@/components/requests/ClosureTabIndicator";
import {
  PENDING_VIVENCIA_ASSIGNMENTS_QUERY_KEY,
  PENDING_VIVENCIA_RECEIVED_QUERY_KEY,
} from "@/lib/pending-vivencias";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Clock, FileText, Loader2, Pencil, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VIVENCIA_TABS = ["informacoes", "atribuicao", "relatorio", "timeline"] as const;
type VivenciaTab = (typeof VIVENCIA_TABS)[number];

function normalizeVivenciaTab(tab: string | undefined, isAdmin: boolean): VivenciaTab {
  if (!tab) return "informacoes";
  const mapped =
    tab === "info" || tab === "informacoes"
      ? "informacoes"
      : tab === "atribuicoes" || tab === "atribuicao"
        ? "atribuicao"
        : tab === "relatorio" || tab === "encerramento"
          ? "relatorio"
          : tab === "timeline"
            ? "timeline"
            : "informacoes";
  if (mapped === "atribuicao" && !isAdmin) return "informacoes";
  return mapped;
}

export const Route = createFileRoute("/_authenticated/modulo-vivencias/demandas/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: VivenciaDemandaDetail,
});

function TimelineTab({
  logs,
  request,
}: {
  logs: VivenciaActivityLogRow[];
  request: Record<string, unknown>;
}) {
  const { professionalIds, actorIds } = collectVivenciaActivityLogLookupIds(logs);

  const { data: professionalNames = {} } = useQuery({
    queryKey: ["vivencia-timeline-professionals", professionalIds],
    queryFn: async () => {
      if (professionalIds.length === 0) return {};
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome")
        .in("id", professionalIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.nome]));
    },
    enabled: professionalIds.length > 0,
  });

  const { data: actorNames = {} } = useQuery({
    queryKey: ["vivencia-timeline-actors", actorIds],
    queryFn: async () => {
      if (actorIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
    },
    enabled: actorIds.length > 0,
  });

  const ctx = {
    request: {
      numero: String(request.numero ?? ""),
      solicitante_nome: request.solicitante_nome as string | null | undefined,
      solicitante_cargo: request.solicitante_cargo as string | null | undefined,
    },
    professionalNames,
    actorNames,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
        <ol className="space-y-4">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 border-l-2 border-border pl-4 pb-2">
                <div className="text-sm font-medium">{vivenciaActivityLogTitle(l.action)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")} • {l.actor_label ?? "Sistema"}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {formatVivenciaActivityLogDescription(l, ctx)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function FormAnswerField({
  item,
  hideNumber,
}: {
  item: { number: number; question: string; answer: string };
  hideNumber?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <div className="text-xs font-medium text-[#64748B]">
        {!hideNumber && item.number > 0 ? `${item.number}. ` : ""}
        {item.question}
      </div>
      <div className="text-sm font-semibold text-[#0F172A]">{item.answer}</div>
    </div>
  );
}

function VivenciaDemandaDetail() {
  const { id } = Route.useParams();
  const { tab: tabFromSearch } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(() => normalizeVivenciaTab(tabFromSearch, isAdmin));
  const [startReportCreate, setStartReportCreate] = useState(false);

  useEffect(() => {
    setActiveTab(normalizeVivenciaTab(tabFromSearch, isAdmin));
  }, [tabFromSearch, isAdmin]);

  const { data: myProfId } = useQuery({
    queryKey: ["my-pro", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user,
  });

  const { data: req, isLoading } = useQuery({
    queryKey: ["vivencia-request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_requests")
        .select(
          "*, school:schools(*), groups:vivencia_request_groups(*), assignees:vivencia_request_assignees(id, professional_id, assigned_at, professional:professionals(id, nome))",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reportMeta } = useQuery({
    queryKey: ["vivencia-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_reports")
        .select("*")
        .eq("vivencia_request_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["vivencia-logs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_activity_logs")
        .select("*")
        .eq("vivencia_request_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
      </div>
    );
  }

  if (!req) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-muted-foreground">Solicitação não encontrada.</p>
        <Button asChild variant="outline">
          <Link to="/modulo-vivencias/demandas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const groups = [...(req.groups ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const assignees =
    (req.assignees as {
      id: string;
      professional_id: string;
      assigned_at: string;
      professional: { id: string; nome: string } | null;
    }[]) ?? [];

  const isAssignee = !!myProfId && assignees.some((a) => a.professional_id === myProfId);
  const canFillReport = isAssignee;
  const assigneeNames = assignees
    .map((a) => a.professional?.nome)
    .filter((n): n is string => Boolean(n));

  const showCreateReportButton =
    canFillReport &&
    !reportMeta &&
    activeTab === "informacoes" &&
    req.status !== "aguardando_aprovacao" &&
    req.status !== "concluida";

  return (
    <div className="space-y-6">
      <PageHeader
        title={req.numero}
        description={req.school_nome_snapshot ?? "Demanda de Vivências"}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/modulo-vivencias/demandas">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={requestStatusTone[req.status] ?? ""}>
          {requestStatusLabels[req.status] ?? req.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Recebida em {new Date(req.created_at).toLocaleString("pt-BR")}
        </span>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(normalizeVivenciaTab(tab, isAdmin));
          if (tab !== "relatorio") setStartReportCreate(false);
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger
              value="informacoes"
              className={cn(activeTab === "informacoes" && "ring-2 ring-primary/30")}
            >
              Informações
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="atribuicao"
                className={cn(
                  "gap-1.5",
                  activeTab === "atribuicao" && "ring-2 ring-primary/30",
                  req.status === "recebida" && assignees.length === 0 && "font-semibold",
                )}
              >
                Atribuição
                {req.status === "recebida" && assignees.length === 0 && (
                  <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
                    !
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger
              value="relatorio"
              className={cn("gap-1.5", activeTab === "relatorio" && "ring-2 ring-primary/30")}
            >
              Relatório
              <ClosureTabIndicator
                closure={reportMeta ? { status: reportMeta.status } : null}
                registeredMeetingsCount={canFillReport && !reportMeta ? 1 : 0}
              />
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className={cn(activeTab === "timeline" && "ring-2 ring-primary/30")}
            >
              Timeline
            </TabsTrigger>
          </TabsList>

          {showCreateReportButton && (
            <Button
              type="button"
              className="shrink-0 self-end sm:self-auto"
              onClick={() => {
                setStartReportCreate(true);
                setActiveTab("relatorio");
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Criar relatório de Vivências escolares
            </Button>
          )}
        </div>

        <TabsContent value="informacoes" className="space-y-4 pt-4">
          <InformacoesTab requestId={id} req={{ ...req, groups }} canEdit={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="atribuicao" className="pt-4">
            <AtribuicaoMulti requestId={id} assignees={assignees} status={req.status} />
          </TabsContent>
        )}

        <TabsContent
          value="relatorio"
          forceMount
          className="pt-4 data-[state=inactive]:hidden"
        >
          <VivenciaRelatorioTab
            requestId={id}
            requestStatus={req.status}
            schoolNome={req.school_nome_snapshot}
            groups={groups.map((g) => ({
              id: g.id,
              aluno_serie: g.aluno_serie,
              aluno_turma: g.aluno_turma,
              periodo: g.periodo,
              temas: g.temas,
              data_preferivel: g.data_preferivel,
            }))}
            assigneeNames={assigneeNames}
            canFill={canFillReport}
            autoStartCreate={startReportCreate}
            onAutoStartCreateHandled={() => setStartReportCreate(false)}
          />
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <TimelineTab logs={logs as VivenciaActivityLogRow[]} request={req} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type GroupRow = {
  id: string;
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[] | null;
  data_preferivel: string | null;
  sort_order: number;
};

type InformacoesReq = {
  school_nome_snapshot?: string | null;
  tipo_escola?: string | null;
  regiao_escola?: string | null;
  school?: { regiao?: string | null } | null;
  solicitante_email?: string | null;
  solicitante_nome?: string | null;
  solicitante_cargo?: string | null;
  solicitante_telefone?: string | null;
  palestra_tema?: string | null;
  data_preferivel_palestra?: string | null;
  groups: GroupRow[];
};

function InformacoesTab({
  requestId,
  req,
  canEdit,
}: {
  requestId: string;
  req: InformacoesReq;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <VivenciaEditForm requestId={requestId} req={req} onDone={() => setEditing(false)} />;
  }

  const sections = buildVivenciaFormSections(req);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />
            Editar demanda
          </Button>
        </div>
      )}
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item, idx) => (
              <FormAnswerField
                key={`${section.title}-${idx}`}
                item={item}
                hideNumber={item.number === 0}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type EditableGroup = {
  id: string;
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[];
  data_preferivel: string;
};

/**
 * A série pode estar gravada como valor ("5") ou como rótulo ("5º ano", padrão do
 * formulário público). Converte para o valor da opção usado pelo Select.
 */
function serieToOptionValue(stored: string | null | undefined): string {
  if (!stored) return "";
  const byValue = alunoSerieOptions.find((o) => o.value === stored);
  if (byValue) return byValue.value;
  const byLabel = alunoSerieOptions.find((o) => o.label === stored);
  return byLabel ? byLabel.value : "";
}

function TemasMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">
            {value.length === 0 ? "Selecionar temas..." : `${value.length} tema(s) selecionado(s)`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {vivenciaTemaOptions.map((tema) => {
            const checked = value.includes(tema.value);
            return (
              <label
                key={tema.value}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={(v) =>
                    onChange(
                      v === true ? [...value, tema.value] : value.filter((t) => t !== tema.value),
                    )
                  }
                />
                <span>{tema.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VivenciaEditForm({
  requestId,
  req,
  onDone,
}: {
  requestId: string;
  req: InformacoesReq;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [groups, setGroups] = useState<EditableGroup[]>(() =>
    req.groups.map((g) => ({
      id: g.id,
      aluno_serie: serieToOptionValue(g.aluno_serie),
      aluno_turma: g.aluno_turma ?? "",
      periodo: g.periodo ?? "",
      temas: g.temas ?? [],
      data_preferivel: g.data_preferivel ?? "",
    })),
  );
  const [palestraTema, setPalestraTema] = useState(req.palestra_tema ?? "");
  const [dataPalestra, setDataPalestra] = useState(req.data_preferivel_palestra ?? "");

  const updateGroup = (id: string, patch: Partial<EditableGroup>) =>
    setGroups((current) => current.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const g of groups) {
        if (g.temas.length === 0) {
          throw new Error("Cada turma precisa de ao menos um tema de vivência.");
        }
      }

      for (const g of groups) {
        if (!g.aluno_serie || !g.aluno_turma || !g.periodo) {
          throw new Error("Preencha série, turma e período de todas as turmas.");
        }
        const { error } = await supabase
          .from("vivencia_request_groups")
          .update({
            aluno_serie:
              alunoSerieLabels[g.aluno_serie as keyof typeof alunoSerieLabels] ?? g.aluno_serie,
            aluno_turma: g.aluno_turma,
            periodo: g.periodo,
            temas: g.temas,
            data_preferivel: g.data_preferivel || null,
          })
          .eq("id", g.id);
        if (error) throw error;
      }

      const { error: reqError } = await supabase
        .from("vivencia_requests")
        .update({
          palestra_tema: palestraTema || null,
          data_preferivel_palestra: dataPalestra || null,
        })
        .eq("id", requestId);
      if (reqError) throw reqError;

      await supabase.from("vivencia_activity_logs").insert({
        vivencia_request_id: requestId,
        actor_id: user?.id,
        action: "demanda_editada",
        details: {
          groups: groups.map((g) => ({
            id: g.id,
            temas: g.temas,
            data_preferivel: g.data_preferivel || null,
          })),
          palestra_tema: palestraTema || null,
          data_preferivel_palestra: dataPalestra || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Demanda atualizada.");
      qc.invalidateQueries({ queryKey: ["vivencia-request", requestId] });
      qc.invalidateQueries({ queryKey: ["vivencia-logs", requestId] });
      qc.invalidateQueries({ queryKey: ["vivencias-demandas"] });
      onDone();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      {groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vivências para alunos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {groups.map((g, i) => (
              <div key={g.id} className="space-y-3 rounded-xl border border-slate-100 p-3">
                <div className="text-sm font-semibold text-[#0F172A]">Turma {i + 1}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Série</Label>
                    <Select
                      value={g.aluno_serie || undefined}
                      onValueChange={(v) => updateGroup(g.id, { aluno_serie: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {alunoSerieOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Turma</Label>
                    <Select
                      value={g.aluno_turma}
                      onValueChange={(v) => updateGroup(g.id, { aluno_turma: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {alunoTurmaOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Período</Label>
                    <Select
                      value={g.periodo}
                      onValueChange={(v) => updateGroup(g.id, { periodo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {periodoOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Temas de vivências *</Label>
                    <TemasMultiSelect
                      value={g.temas}
                      onChange={(next) => updateGroup(g.id, { temas: next })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data preferível da Vivência</Label>
                    <Input
                      type="date"
                      value={g.data_preferivel}
                      onChange={(e) => updateGroup(g.id, { data_preferivel: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Palestras e datas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Palestra</Label>
            <Select value={palestraTema} onValueChange={setPalestraTema}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {palestraTemaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data preferível — Palestra</Label>
            <Input
              type="date"
              value={dataPalestra}
              onChange={(e) => setDataPalestra(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={saveMut.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function AtribuicaoMulti({
  requestId,
  assignees,
  status,
}: {
  requestId: string;
  assignees: {
    id: string;
    professional_id: string;
    assigned_at: string;
    professional: { id: string; nome: string } | null;
  }[];
  status: string;
}) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-active-vivencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome")
        .eq("status", "ativo")
        .eq("atende_vivencias", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const assignedIds = new Set(assignees.map((a) => a.professional_id));
  const available = professionals.filter((p) => !assignedIds.has(p.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vivencia-request", requestId] });
    qc.invalidateQueries({ queryKey: ["vivencia-logs", requestId] });
    qc.invalidateQueries({ queryKey: ["vivencias-demandas"] });
    qc.invalidateQueries({ queryKey: PENDING_VIVENCIA_RECEIVED_QUERY_KEY });
    qc.invalidateQueries({ queryKey: PENDING_VIVENCIA_ASSIGNMENTS_QUERY_KEY });
  };

  const assignMut = useMutation({
    mutationFn: async (professionalIds: string[]) => {
      const { error } = await supabase.from("vivencia_request_assignees").insert(
        professionalIds.map((professionalId) => ({
          vivencia_request_id: requestId,
          professional_id: professionalId,
          assigned_by: user?.id,
        })),
      );
      if (error) throw error;

      if (status === "recebida") {
        await supabase
          .from("vivencia_requests")
          .update({ status: "distribuida" })
          .eq("id", requestId);
      }

      await supabase.from("vivencia_activity_logs").insert({
        vivencia_request_id: requestId,
        actor_id: user?.id,
        action: "atribuicao",
        details: { professional_ids: professionalIds },
      });
    },
    onSuccess: () => {
      toast.success(
        selectedProfessionals.length === 1
          ? "Profissional atribuído."
          : `${selectedProfessionals.length} profissionais atribuídos.`,
      );
      setSelectedProfessionals([]);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao atribuir", { description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: async (assigneeId: string) => {
      const target = assignees.find((a) => a.id === assigneeId);
      const { error } = await supabase
        .from("vivencia_request_assignees")
        .delete()
        .eq("id", assigneeId);
      if (error) throw error;

      const remaining = assignees.filter((a) => a.id !== assigneeId);
      if (remaining.length === 0) {
        await supabase.from("vivencia_requests").update({ status: "recebida" }).eq("id", requestId);
      }

      await supabase.from("vivencia_activity_logs").insert({
        vivencia_request_id: requestId,
        actor_id: user?.id,
        action: "atribuicao_desfeita",
        details: { previous_professional_id: target?.professional_id },
      });
    },
    onSuccess: () => {
      toast.success("Atribuição removida.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Profissionais atribuídos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum profissional atribuído ainda.</p>
          ) : (
            <ul className="space-y-2">
              {assignees.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold">{a.professional?.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      Desde {new Date(a.assigned_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => removeMut.mutate(a.id)}
                    disabled={removeMut.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedProfessionals.length === 0
                      ? "Selecionar profissionais..."
                      : `${selectedProfessionals.length} profissional(is) selecionado(s)`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                {available.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Todos os profissionais disponíveis já foram atribuídos.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {available.map((professional) => {
                      const checked = selectedProfessionals.includes(professional.id);
                      return (
                        <label
                          key={professional.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              setSelectedProfessionals((current) =>
                                value === true
                                  ? [...current, professional.id]
                                  : current.filter((id) => id !== professional.id),
                              )
                            }
                          />
                          {professional.nome}
                        </label>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button
              disabled={selectedProfessionals.length === 0 || assignMut.isPending}
              onClick={() => assignMut.mutate(selectedProfessionals)}
            >
              {assignMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atribuir selecionados
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            É possível atribuir mais de um profissional à mesma demanda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
