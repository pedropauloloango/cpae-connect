import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { VisitScheduleForm } from "@/components/meetings/VisitScheduleForm";
import { SchoolSearchSelect, type PublicSchoolOption } from "@/components/schools/SchoolSearchSelect";
import { appointmentToFormValues, updateVisitAppointment } from "@/lib/appointment-update";
import { datetimeLocalToIso } from "@/lib/appointment-utils";
import {
  complaintTypeLabels,
  meetingNumberLabels,
  meetingTypeLabels,
  schoolRepresentativeLabels,
  visitTypeOptions,
} from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/agenda")({ component: Agenda });

type AgendaAppointment = {
  id: string;
  titulo: string;
  tipo: string;
  inicio: string;
  fim: string;
  observacoes: string | null;
  numero: string | null;
  representante_cargo: string | null;
  representante_nome: string | null;
  school_id: string | null;
  professional: { id: string; nome: string } | null;
  request: {
    id: string;
    numero: string;
    aluno_nome: string;
    aluno_serie: string | null;
    aluno_turma: string | null;
    tipo_queixa: string | null;
    school_nome_snapshot: string | null;
    school_id: string | null;
  } | null;
};

function appointmentMatchesSchoolFilter(
  appointment: AgendaAppointment,
  schoolFilter: string,
  schoolNameById: Record<string, string>,
): boolean {
  if (schoolFilter === "todas") return true;

  const appointmentSchoolId = appointment.school_id ?? appointment.request?.school_id;
  if (appointmentSchoolId) return appointmentSchoolId === schoolFilter;

  const selectedSchoolName = schoolNameById[schoolFilter];
  if (!selectedSchoolName) return false;

  const snapshot = appointment.request?.school_nome_snapshot?.trim().toLowerCase() ?? "";
  return snapshot === selectedSchoolName.toLowerCase();
}

function buildEventTitle(a: AgendaAppointment, showProfessional: boolean): string {
  const escola = a.request?.school_nome_snapshot ?? a.titulo;
  const numeroLabel = a.numero ? meetingNumberLabels[a.numero] : "Visita";
  const tipoLabel = meetingTypeLabels[a.tipo] ?? a.tipo;
  const core = `${numeroLabel} • ${tipoLabel} • ${escola}`;
  if (showProfessional && a.professional?.nome) {
    return `[${a.professional.nome}] ${core}`;
  }
  return core;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function Agenda() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [profFilter, setProfFilter] = useState<string>("todos");
  const [schoolFilter, setSchoolFilter] = useState<string>("todas");
  const [alunoFilter, setAlunoFilter] = useState("");

  const { data: myProfId } = useQuery({
    queryKey: ["my-pro", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("professionals").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-agenda-acolhimento"],
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

  const { data: schoolsWithDemands = [], isLoading: loadingSchoolsWithDemands } = useQuery({
    queryKey: ["schools-with-demands-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("school_id, school:schools(id, nome, regiao, tipo_escola)")
        .is("deleted_at", null)
        .not("school_id", "is", null);
      if (error) throw error;

      const byId = new Map<string, PublicSchoolOption>();
      for (const row of data ?? []) {
        const school = row.school as PublicSchoolOption | null;
        if (school?.id) byId.set(school.id, school);
      }

      return [...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    enabled: isAdmin,
  });

  const schoolNameById = useMemo(
    () => Object.fromEntries(schoolsWithDemands.map((s) => [s.id, s.nome])),
    [schoolsWithDemands],
  );

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", isAdmin, myProfId],
    enabled: isAdmin || myProfId !== undefined,
    queryFn: async () => {
      if (!isAdmin && !myProfId) return [];

      let qb = supabase
        .from("appointments")
        .select(`
          id, titulo, tipo, inicio, fim, observacoes, numero, representante_cargo, representante_nome, school_id,
          professional:professionals(id, nome),
          request:requests(
            id, numero, aluno_nome, aluno_serie, aluno_turma, tipo_queixa, school_nome_snapshot, school_id
          )
        `)
        .is("vivencia_request_id", null)
        .order("inicio");

      // Profissional vê apenas os próprios agendamentos
      if (!isAdmin && myProfId) qb = qb.eq("professional_id", myProfId);

      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as AgendaAppointment[];
    },
  });

  const filteredAppointments = useMemo(() => {
    if (!isAdmin) return appointments;

    const alunoQuery = alunoFilter.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (profFilter !== "todos" && appointment.professional?.id !== profFilter) return false;
      if (!appointmentMatchesSchoolFilter(appointment, schoolFilter, schoolNameById)) return false;
      if (alunoQuery) {
        const alunoNome = appointment.request?.aluno_nome?.toLowerCase() ?? "";
        if (!alunoNome.includes(alunoQuery)) return false;
      }
      return true;
    });
  }, [appointments, isAdmin, profFilter, schoolFilter, alunoFilter, schoolNameById]);

  const hasActiveFilters =
    isAdmin && (profFilter !== "todos" || schoolFilter !== "todas" || alunoFilter.trim().length > 0);

  const clearFilters = () => {
    setProfFilter("todos");
    setSchoolFilter("todas");
    setAlunoFilter("");
  };

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const events = filteredAppointments.map((a) => ({
    id: a.id,
    title: buildEventTitle(a, isAdmin),
    start: a.inicio,
    end: a.fim,
  }));

  const updateMut = useMutation({
    mutationFn: async (params: { appointment: AgendaAppointment; values: Parameters<typeof updateVisitAppointment>[0]["values"] }) => {
      const a = params.appointment;
      await updateVisitAppointment({
        appointmentId: a.id,
        values: params.values,
        requestId: a.request?.id,
        protocolo: a.request?.numero,
        escolaNome: a.request?.school_nome_snapshot ?? undefined,
        numero: a.numero as import("@/lib/meeting-schedule").MeetingNumber | null,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Agendamento atualizado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setDetailMode("view");
    },
    onError: (e: Error) => toast.error("Erro ao editar", { description: e.message }),
  });

  const createMut = useMutation({
    mutationFn: async (v: { titulo: string; tipo: string; inicio: string; fim: string; observacoes: string }) => {
      const { error } = await supabase.from("appointments").insert({
        titulo: v.titulo,
        tipo: v.tipo as "acolhimento",
        inicio: datetimeLocalToIso(v.inicio),
        fim: datetimeLocalToIso(v.fim),
        observacoes: v.observacoes.trim() || null,
        professional_id: myProfId ?? null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compromisso criado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setOpenCreate(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={isAdmin ? "Visualize os agendamentos de visitas de todos os profissionais." : "Sua agenda de visitas e compromissos."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isAdmin && (
              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Novo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      createMut.mutate({
                        titulo: String(f.get("titulo")),
                        tipo: String(f.get("tipo")),
                        inicio: String(f.get("inicio")),
                        fim: String(f.get("fim")),
                        observacoes: String(f.get("obs") ?? ""),
                      });
                    }}
                  >
                    <div className="space-y-1.5"><Label>Título *</Label><Input name="titulo" required /></div>
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select name="tipo" defaultValue="acolhimento">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {visitTypeOptions.map((k) => (
                            <SelectItem key={k} value={k}>{meetingTypeLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Início *</Label><Input name="inicio" type="datetime-local" required /></div>
                      <div className="space-y-1.5"><Label>Fim *</Label><Input name="fim" type="datetime-local" required /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Observações</Label><Textarea name="obs" rows={2} /></div>
                    <Button type="submit" className="w-full" disabled={createMut.isPending}>Salvar</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      {isAdmin && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="agenda-filter-prof">Profissional</Label>
              <Select value={profFilter} onValueChange={setProfFilter}>
                <SelectTrigger id="agenda-filter-prof">
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os profissionais</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agenda-filter-school">Escola</Label>
              <SchoolSearchSelect
                schools={schoolsWithDemands}
                value={schoolFilter === "todas" ? null : schoolFilter}
                onSelect={(school) => setSchoolFilter(school.id)}
                loading={loadingSchoolsWithDemands}
                placeholder="Todas as escolas com demanda…"
                searchPlaceholder="Buscar escola com demanda…"
                emptyLabel="Nenhuma escola com demanda encontrada."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agenda-filter-aluno">Aluno</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="agenda-filter-aluno"
                  className="pl-9"
                  placeholder="Buscar por nome do aluno…"
                  value={alunoFilter}
                  onChange={(e) => setAlunoFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full xl:w-auto"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={ptBr}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={events}
            eventClick={(info) => {
              setSelectedId(info.event.id);
              setDetailMode("view");
            }}
            height="auto"
            editable={false}
            selectable
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetailMode("view");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          {selected && detailMode === "view" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">
                  {buildEventTitle(selected, false)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Início"
                    value={new Date(selected.inicio).toLocaleString("pt-BR")}
                  />
                  <DetailField
                    label="Término"
                    value={new Date(selected.fim).toLocaleString("pt-BR")}
                  />
                </div>

                {isAdmin && selected.professional && (
                  <DetailField label="Profissional" value={selected.professional.nome} />
                )}

                {selected.request ? (
                  <>
                    <DetailField label="Protocolo" value={selected.request.numero} />
                    <DetailField label="Aluno" value={selected.request.aluno_nome} />
                    <DetailField label="Série" value={selected.request.aluno_serie} />
                    <DetailField label="Turma" value={selected.request.aluno_turma} />
                    <DetailField
                      label="Queixa"
                      value={
                        selected.request.tipo_queixa
                          ? complaintTypeLabels[selected.request.tipo_queixa]
                          : null
                      }
                    />
                    <DetailField label="Escola" value={selected.request.school_nome_snapshot} />
                  </>
                ) : (
                  <DetailField label="Título" value={selected.titulo} />
                )}

                {(selected.representante_nome || selected.representante_cargo) && (
                  <DetailField
                    label="Representante da escola"
                    value={
                      selected.representante_nome
                        ? `${selected.representante_nome}${
                            selected.representante_cargo
                              ? ` (${schoolRepresentativeLabels[selected.representante_cargo]})`
                              : ""
                          }`
                        : selected.representante_cargo
                          ? schoolRepresentativeLabels[selected.representante_cargo]
                          : null
                    }
                  />
                )}

                {selected.observacoes && (
                  <DetailField label="Observações" value={selected.observacoes} />
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {!isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDetailMode("edit")}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar agendamento
                    </Button>
                  )}
                  {selected.request && (
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to="/demandas/$id" params={{ id: selected.request.id }} onClick={() => setSelectedId(null)}>
                        Ver demanda
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {selected && detailMode === "edit" && !isAdmin && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Editar agendamento</DialogTitle>
              </DialogHeader>
              <VisitScheduleForm
                formKey={selected.id}
                defaultValues={appointmentToFormValues(selected)}
                submitLabel="Salvar alterações"
                isPending={updateMut.isPending}
                onCancel={() => setDetailMode("view")}
                onSubmit={(values) => updateMut.mutate({ appointment: selected, values })}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
