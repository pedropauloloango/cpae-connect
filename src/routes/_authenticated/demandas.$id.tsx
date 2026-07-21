import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/AppShell";
import { complaintTypeLabels, meetingNumberLabels, isRequestLockedForMeetingEdits } from "@/lib/labels";
import { buildAcolhimentoFormSections, getSectionLayoutRows, type AcolhimentoFormAnswer, type AcolhimentoFormSection } from "@/lib/acolhimento-form-display";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { MeetingCountIndicators, summarizeMeetings } from "@/components/requests/MeetingCountIndicators";
import { ClosureTabIndicator } from "@/components/requests/ClosureTabIndicator";
import { EncerramentoTab, type CaseClosureRow } from "@/components/closures/EncerramentoTab";
import {
  activityLogTitle,
  collectActivityLogLookupIds,
  formatActivityLogDescription,
  type ActivityLogRow,
} from "@/lib/activity-log-descriptions";
import { EncontrosTab } from "@/components/meetings/EncontrosTab";
import { getNextRegisterAction, getNextScheduleNumero, type RequestAppointment } from "@/lib/meeting-schedule";
import { PENDING_ASSIGNMENTS_QUERY_KEY, PENDING_RECEIVED_REQUESTS_QUERY_KEY } from "@/lib/pending-approvals";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, UserMinus, Clock, FileText, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: DemandaDetail,
});

function DemandaDetail() {
  const { id } = useParams({ from: "/_authenticated/demandas/$id" });
  const { tab } = Route.useSearch();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(tab ?? "info");
  const [openMeetingForm, setOpenMeetingForm] = useState(false);
  const [openScheduleForm, setOpenScheduleForm] = useState(false);

  const { data: req, isLoading, isError, error } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, school:schools(*), professional:professionals!assigned_professional_id(*)")
        .eq("id", id).single();
      if (error) throw error; return data;
    },
  });

  const formSections = req ? buildAcolhimentoFormSections(req) : [];

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", id],
    queryFn: async () => {
      const { data } = await supabase.from("meetings").select("*").eq("request_id", id).order("created_at");
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs", id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").eq("request_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, numero, tipo, inicio, fim, representante_cargo, representante_nome, observacoes, created_at")
        .eq("request_id", id)
        .order("inicio");
      if (error) throw error;
      return (data ?? []) as RequestAppointment[];
    },
  });

  const { data: closure } = useQuery({
    queryKey: ["closure", id],
    queryFn: async () => {
      const { data } = await supabase.from("case_closures").select("*").eq("request_id", id).maybeSingle();
      return data;
    },
  });

  const scheduleNumero = getNextScheduleNumero(appointments);
  const nextRegister = getNextRegisterAction(appointments, meetings);
  const registerNumero = nextRegister?.numero ?? null;
  const registerAppointment = nextRegister?.appointment ?? null;
  const { registered: registeredMeetingsCount } = summarizeMeetings(meetings);
  const encontrosLockedForProfessional = !isAdmin && isRequestLockedForMeetingEdits(req?.status ?? null);

  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  return (
    <div>
      <Link to="/demandas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageHeader
        title={req?.aluno_nome ?? "Demanda"}
        description={req ? `Protocolo ${req.numero}${req.tipo_queixa ? ` • ${complaintTypeLabels[req.tipo_queixa]}` : ""}` : ""}
        actions={req && <RequestStatusBadge status={req.status} />}
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          if (tab !== "encontros") {
            setOpenMeetingForm(false);
            setOpenScheduleForm(false);
          }
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className={`grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:inline-grid lg:w-auto ${isAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <TabsTrigger value="info">Informações</TabsTrigger>
            {isAdmin && <TabsTrigger value="atribuicao">Atribuição</TabsTrigger>}
            <TabsTrigger value="encontros" className="gap-1.5">
              Encontros
              <MeetingCountIndicators meetings={meetings} />
            </TabsTrigger>
            <TabsTrigger value="encerramento" className="gap-1.5">
              Encerramento
              <ClosureTabIndicator
                closure={closure as CaseClosureRow | null | undefined}
                registeredMeetingsCount={registeredMeetingsCount}
              />
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {activeTab === "encontros" && !encontrosLockedForProfessional && (scheduleNumero || registerNumero) && !openScheduleForm && !openMeetingForm && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 self-end sm:self-auto">
              {scheduleNumero && (
                <Button onClick={() => setOpenScheduleForm(true)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar visita — {meetingNumberLabels[scheduleNumero]}
                </Button>
              )}
              {registerNumero && (
                <Button
                  variant={scheduleNumero ? "outline" : "default"}
                  onClick={() => setOpenMeetingForm(true)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Registrar {meetingNumberLabels[registerNumero]}
                </Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="info" className="space-y-4">
          {isLoading && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando solicitação…</CardContent>
            </Card>
          )}

          {isError && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-destructive">
                Não foi possível carregar a solicitação.{error instanceof Error ? ` ${error.message}` : ""}
              </CardContent>
            </Card>
          )}

          {req && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Protocolo</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormAnswerField item={{ number: 0, question: "Número", answer: req.numero }} hideNumber />
                    <FormAnswerField
                      item={{ number: 0, question: "Recebida em", answer: new Date(req.created_at).toLocaleString("pt-BR") }}
                      hideNumber
                    />
                    <div className="space-y-1.5">
                      <Label className="font-normal leading-snug text-muted-foreground">Status</Label>
                      <div className="flex min-h-9 items-center rounded-md border border-input bg-muted/40 px-3 py-2">
                        <RequestStatusBadge status={req.status} />
                      </div>
                    </div>
                    <FormAnswerField
                      item={{
                        number: 0,
                        question: "Tipo de queixa (derivado)",
                        answer: req.tipo_queixa ? complaintTypeLabels[req.tipo_queixa] : "—",
                      }}
                      hideNumber
                    />
                  </div>
                </CardContent>
              </Card>

              {formSections.map((section) => (
                <FormSectionCard key={section.title} section={section} />
              ))}
            </>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="atribuicao">
            <AtribuicaoTab
              requestId={id}
              assignedProfessionalId={req?.assigned_professional_id ?? null}
              assignedAt={req?.assigned_at ?? null}
              professionalName={req?.professional?.nome ?? null}
              status={req?.status ?? null}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}

        <TabsContent value="encontros">
          <EncontrosTab
            requestId={id}
            protocolo={req?.numero ?? ""}
            escolaNome={req?.school_nome_snapshot ?? req?.school?.nome ?? "Escola"}
            schoolId={req?.school_id ?? null}
            alunoNome={req?.aluno_nome ?? ""}
            alunoSerie={req?.aluno_turma_ano ?? req?.aluno_serie ?? ""}
            tipoQueixa={req?.tipo_queixa ? complaintTypeLabels[req.tipo_queixa] ?? req.tipo_queixa : ""}
            meetings={meetings}
            appointments={appointments}
            professionalId={req?.assigned_professional_id ?? null}
            registerNumero={registerNumero}
            scheduleNumero={scheduleNumero}
            openRegisterForm={openMeetingForm}
            openScheduleForm={openScheduleForm}
            onOpenRegisterFormChange={setOpenMeetingForm}
            onOpenScheduleFormChange={setOpenScheduleForm}
            registerAppointment={registerAppointment}
            requestStatus={req?.status ?? null}
          />
        </TabsContent>

        <TabsContent value="encerramento">
          <EncerramentoTab
            requestId={id}
            protocolo={req?.numero ?? ""}
            escolaNome={req?.school_nome_snapshot ?? req?.school?.nome ?? "Escola"}
            alunoNome={req?.aluno_nome ?? ""}
            requestStatus={req?.status ?? null}
            closure={closure as CaseClosureRow | null | undefined}
            meetings={meetings as import("@/components/closures/EncerramentoTab").EncerramentoMeeting[]}
            appointments={appointments}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab logs={logs as ActivityLogRow[]} request={req} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TimelineTab({
  logs,
  request,
}: {
  logs: ActivityLogRow[];
  request: Record<string, unknown> | null | undefined;
}) {
  const { professionalIds, actorIds } = collectActivityLogLookupIds(logs);

  const { data: professionalNames = {} } = useQuery({
    queryKey: ["timeline-professionals", professionalIds],
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
    queryKey: ["timeline-actors", actorIds],
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
    request: request
      ? {
          numero: String(request.numero ?? ""),
          solicitante_nome: request.solicitante_nome as string | null | undefined,
          solicitante_cargo: request.solicitante_cargo as string | null | undefined,
          solicitante_nome_cargo: request.solicitante_nome_cargo as string | null | undefined,
        }
      : null,
    professionalNames,
    actorNames,
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
      <CardContent>
        {logs.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
        <ol className="space-y-4">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 border-l-2 border-border pl-4 pb-2">
                <div className="text-sm font-medium">{activityLogTitle(l.action)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")} • {l.actor_label ?? "Sistema"}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {formatActivityLogDescription(l, ctx)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function formSectionRowGridClass(columnCount: number): string | undefined {
  if (columnCount <= 1) return undefined;
  if (columnCount === 2) return "grid gap-4 sm:grid-cols-2";
  if (columnCount === 3) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  if (columnCount >= 4) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";
  return undefined;
}

function FormSectionCard({ section }: { section: AcolhimentoFormSection }) {
  const rows = getSectionLayoutRows(section);
  const itemByNumber = Object.fromEntries(section.items.map((i) => [i.number, i]));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className={formSectionRowGridClass(row.length)}>
            {row.map((num) => {
              const item = itemByNumber[num];
              return item ? <FormAnswerField key={num} item={item} /> : null;
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FormAnswerField({
  item,
  hideNumber,
  answerSlot,
}: {
  item: AcolhimentoFormAnswer;
  hideNumber?: boolean;
  answerSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-normal leading-snug text-muted-foreground">
        {hideNumber ? item.question : `${item.number}. ${item.question}`}
      </Label>
      <div className={`min-h-9 whitespace-pre-wrap rounded-md border border-input bg-muted/40 px-3 py-2 text-sm${hideNumber && item.question === "Número" ? " font-mono" : ""}`}>
        {answerSlot ?? item.answer}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

function AtribuicaoTab({
  requestId,
  assignedProfessionalId,
  assignedAt,
  professionalName,
  status,
  isAdmin,
}: {
  requestId: string;
  assignedProfessionalId: string | null;
  assignedAt: string | null;
  professionalName: string | null;
  status: string | null;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedProfessional, setSelectedProfessional] = useState("");

  const { data: professionals = [], isLoading: loadingProfessionals } = useQuery({
    queryKey: ["professionals-active-acolhimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome")
        .eq("status", "ativo")
        .eq("atende_acolhimento", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["request", requestId] });
    qc.invalidateQueries({ queryKey: ["logs", requestId] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
    qc.invalidateQueries({ queryKey: PENDING_RECEIVED_REQUESTS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: PENDING_ASSIGNMENTS_QUERY_KEY });
  };

  const assignMut = useMutation({
    mutationFn: async (professionalId: string) => {
      const { error } = await supabase
        .from("requests")
        .update({
          assigned_professional_id: professionalId,
          assigned_at: new Date().toISOString(),
          assigned_by: user?.id,
          status: "distribuida",
        })
        .eq("id", requestId);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "atribuicao",
        details: { professional_id: professionalId },
      });
    },
    onSuccess: () => {
      toast.success("Profissional atribuído.");
      setSelectedProfessional("");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao atribuir", { description: e.message }),
  });

  const unassignMut = useMutation({
    mutationFn: async () => {
      const previousProfessionalId = assignedProfessionalId;
      const { error } = await supabase
        .from("requests")
        .update({
          assigned_professional_id: null,
          assigned_at: null,
          assigned_by: null,
          status: "recebida",
        })
        .eq("id", requestId);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "atribuicao_desfeita",
        details: { previous_professional_id: previousProfessionalId },
      });
    },
    onSuccess: () => {
      toast.success("Atribuição desfeita.");
      setSelectedProfessional("");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao desfazer atribuição", { description: e.message }),
  });

  const handleAssign = () => {
    if (!selectedProfessional) return;
    assignMut.mutate(selectedProfessional);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Situação da atribuição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormAnswerField
              item={{
                number: 0,
                question: "Profissional responsável",
                answer: professionalName ?? "Não atribuído",
              }}
              hideNumber
            />
            <FormAnswerField
              item={{
                number: 0,
                question: "Status da demanda",
                answer: "",
              }}
              hideNumber
              answerSlot={status ? <RequestStatusBadge status={status} /> : <span className="text-sm">—</span>}
            />
          </div>
          <FormAnswerField
            item={{
              number: 0,
              question: "Atribuída em",
              answer: assignedAt ? new Date(assignedAt).toLocaleString("pt-BR") : "—",
            }}
            hideNumber
          />
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Somente administradores podem atribuir ou desfazer atribuições.
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaminhar ao profissional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select
                value={selectedProfessional}
                onValueChange={setSelectedProfessional}
                disabled={loadingProfessionals || assignMut.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingProfessionals ? "Carregando…" : "Escolher profissional…"} />
                </SelectTrigger>
                <SelectContent>
                  {professionals.length === 0 && (
                    <SelectItem value="__empty" disabled>Nenhum profissional ativo cadastrado</SelectItem>
                  )}
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAssign}
                disabled={!selectedProfessional || assignMut.isPending || professionals.length === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {assignedProfessionalId ? "Reatribuir" : "Atribuir"}
              </Button>

              {assignedProfessionalId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={unassignMut.isPending}>
                      <UserMinus className="mr-2 h-4 w-4" />
                      Desfazer atribuição
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desfazer atribuição?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A demanda será removida de {professionalName ?? "o profissional atual"} e voltará ao status
                        &quot;Solicitação Recebida&quot;. Esta ação ficará registrada na timeline.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => unassignMut.mutate()}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
