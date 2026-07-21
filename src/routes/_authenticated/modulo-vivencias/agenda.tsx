import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SchoolSearchSelect, type PublicSchoolOption } from "@/components/schools/SchoolSearchSelect";
import {
  normalizeRegiaoFromSchool,
  periodoOptions,
  regiaoEscolaLabel,
  regiaoEscolaOptions,
} from "@/lib/acolhimento-options";
import { palestraTemaLabel } from "@/lib/vivencias-options";
import { Loader2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/agenda")({
  component: VivenciasAgenda,
});

type PreferidaGroup = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  data_preferivel: string | null;
};

type Assignee = {
  professional_id?: string;
  professional: { id?: string; nome: string } | null;
};

function assigneeNames(assignees: Assignee[] | null | undefined): string | null {
  const names = (assignees ?? []).map((a) => a.professional?.nome).filter((n): n is string => !!n);
  return names.length > 0 ? names.join(", ") : null;
}

function assigneeIds(assignees: Assignee[] | null | undefined): string[] {
  return (assignees ?? [])
    .map((a) => a.professional_id ?? a.professional?.id)
    .filter((id): id is string => Boolean(id));
}

type Preferida = {
  id: string;
  numero: string;
  school_id: string | null;
  school_nome_snapshot: string | null;
  regiao_escola: string | null;
  data_preferivel_vivencia: string | null;
  data_preferivel_palestra: string | null;
  palestra_tema: string | null;
  school: { id: string; nome: string; regiao: string | null; tipo_escola: "escola" | "emei" | null } | null;
  groups: PreferidaGroup[] | null;
  assignees: Assignee[] | null;
};

function vivenciaDates(p: Preferida): { label: string; date: string; periodo: string | null }[] {
  const items: { label: string; date: string; periodo: string | null }[] = [];
  for (const g of p.groups ?? []) {
    if (g.data_preferivel) {
      items.push({
        label: `${g.aluno_serie} ${g.aluno_turma}`,
        date: g.data_preferivel,
        periodo: g.periodo ?? null,
      });
    }
  }
  if (items.length === 0 && p.data_preferivel_vivencia) {
    items.push({ label: "Vivência", date: p.data_preferivel_vivencia, periodo: null });
  }
  return items;
}

function requestRegiao(p: {
  regiao_escola?: string | null;
  school?: { regiao?: string | null } | null;
}): string {
  return normalizeRegiaoFromSchool(p.regiao_escola ?? p.school?.regiao ?? "");
}

type AgendaAppt = {
  id: string;
  titulo: string;
  tipo: string;
  inicio: string;
  fim: string;
  vivencia_request_id: string | null;
  professional: { id: string; nome: string } | null;
  vivencia_request: {
    id: string;
    numero: string;
    school_id: string | null;
    school_nome_snapshot: string | null;
    regiao_escola: string | null;
    school: { id: string; nome: string; regiao: string | null; tipo_escola: "escola" | "emei" | null } | null;
    groups: { periodo: string }[] | null;
    assignees: Assignee[] | null;
  } | null;
};

type SelectedEvent = {
  title: string;
  requestId: string | null;
  fields: { label: string; value: string | null }[];
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: { detail: SelectedEvent };
};

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

function VivenciasAgenda() {
  const [viewHint] = useState("dayGridMonth");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [regiaoFilter, setRegiaoFilter] = useState("todas");
  const [profFilter, setProfFilter] = useState("todos");
  const [schoolFilter, setSchoolFilter] = useState("todas");
  const [periodoFilter, setPeriodoFilter] = useState("todos");

  const { data: preferidas = [], isLoading: loadingPref } = useQuery({
    queryKey: ["vivencias-datas-preferidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_requests")
        .select(
          "id, numero, school_id, school_nome_snapshot, regiao_escola, data_preferivel_vivencia, data_preferivel_palestra, palestra_tema, school:schools(id, nome, regiao, tipo_escola), groups:vivencia_request_groups(aluno_serie, aluno_turma, periodo, data_preferivel), assignees:vivencia_request_assignees(professional_id, professional:professionals(id, nome))",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data ?? []) as unknown as Preferida[]).filter(
        (p) => vivenciaDates(p).length > 0 || p.data_preferivel_palestra,
      );
    },
  });

  const { data: appointments = [], isLoading: loadingAppt } = useQuery({
    queryKey: ["vivencias-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, titulo, tipo, inicio, fim, vivencia_request_id, professional:professionals(id, nome), vivencia_request:vivencia_requests(id, numero, school_id, school_nome_snapshot, regiao_escola, school:schools(id, nome, regiao, tipo_escola), groups:vivencia_request_groups(periodo), assignees:vivencia_request_assignees(professional_id, professional:professionals(id, nome)))",
        )
        .not("vivencia_request_id", "is", null)
        .order("inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendaAppt[];
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-agenda-vivencias"],
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
  });

  const schoolsWithDemands = useMemo(() => {
    const byId = new Map<string, PublicSchoolOption>();
    for (const p of preferidas) {
      if (p.school?.id) {
        byId.set(p.school.id, {
          id: p.school.id,
          nome: p.school.nome,
          regiao: p.school.regiao,
          tipo_escola: p.school.tipo_escola ?? "escola",
        });
      } else if (p.school_id && p.school_nome_snapshot) {
        byId.set(p.school_id, {
          id: p.school_id,
          nome: p.school_nome_snapshot,
          regiao: p.regiao_escola,
          tipo_escola: "escola",
        });
      }
    }
    for (const a of appointments) {
      const school = a.vivencia_request?.school;
      if (school?.id) {
        byId.set(school.id, {
          id: school.id,
          nome: school.nome,
          regiao: school.regiao,
          tipo_escola: school.tipo_escola ?? "escola",
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [preferidas, appointments]);

  const matchesCommonFilters = (opts: {
    regiao: string;
    schoolId: string | null;
    schoolNome: string | null;
    professionalIds: string[];
    periodos: string[];
  }) => {
    if (regiaoFilter !== "todas" && opts.regiao !== regiaoFilter) return false;
    if (schoolFilter !== "todas") {
      if (opts.schoolId) {
        if (opts.schoolId !== schoolFilter) return false;
      } else if (opts.schoolNome) {
        const selected = schoolsWithDemands.find((s) => s.id === schoolFilter);
        if (!selected || selected.nome !== opts.schoolNome) return false;
      } else {
        return false;
      }
    }
    if (profFilter !== "todos" && !opts.professionalIds.includes(profFilter)) return false;
    if (periodoFilter !== "todos") {
      if (opts.periodos.length === 0 || !opts.periodos.includes(periodoFilter)) return false;
    }
    return true;
  };

  const filteredPreferidas = useMemo(() => {
    return preferidas.filter((p) =>
      matchesCommonFilters({
        regiao: requestRegiao(p),
        schoolId: p.school_id ?? p.school?.id ?? null,
        schoolNome: p.school_nome_snapshot,
        professionalIds: assigneeIds(p.assignees),
        periodos: (p.groups ?? []).map((g) => g.periodo).filter(Boolean),
      }),
    );
  }, [preferidas, regiaoFilter, schoolFilter, profFilter, periodoFilter, schoolsWithDemands]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const req = a.vivencia_request;
      const professionalIds = [
        ...(a.professional?.id ? [a.professional.id] : []),
        ...assigneeIds(req?.assignees),
      ];
      return matchesCommonFilters({
        regiao: requestRegiao(req ?? {}),
        schoolId: req?.school_id ?? req?.school?.id ?? null,
        schoolNome: req?.school_nome_snapshot ?? null,
        professionalIds,
        periodos: (req?.groups ?? []).map((g) => g.periodo).filter(Boolean),
      });
    });
  }, [appointments, regiaoFilter, schoolFilter, profFilter, periodoFilter, schoolsWithDemands]);

  const events = useMemo(() => {
    const fromAppts: CalendarEvent[] = filteredAppointments.map((a) => {
      const detail: SelectedEvent = {
        title: `${a.vivencia_request?.numero ?? "VIV"} • ${a.titulo}`,
        requestId: a.vivencia_request_id,
        fields: [
          { label: "Início", value: new Date(a.inicio).toLocaleString("pt-BR") },
          { label: "Término", value: new Date(a.fim).toLocaleString("pt-BR") },
          { label: "Profissional", value: a.professional?.nome ?? null },
          { label: "Protocolo", value: a.vivencia_request?.numero ?? null },
          { label: "Escola", value: a.vivencia_request?.school_nome_snapshot ?? null },
          {
            label: "Região",
            value: regiaoEscolaLabel(requestRegiao(a.vivencia_request ?? {})),
          },
          {
            label: "Profissionais atribuídos",
            value: assigneeNames(a.vivencia_request?.assignees),
          },
        ],
      };
      return {
        id: a.id,
        title: detail.title,
        start: a.inicio,
        end: a.fim,
        backgroundColor: "#0F52BA",
        borderColor: "#0F52BA",
        extendedProps: { detail },
      };
    });

    const fromPrefs = filteredPreferidas.flatMap((p) => {
      const items: CalendarEvent[] = [];
      vivenciaDates(p).forEach((d, i) => {
        if (periodoFilter !== "todos" && d.periodo && d.periodo !== periodoFilter) return;
        if (periodoFilter !== "todos" && !d.periodo) return;
        items.push({
          id: `${p.id}-viv-${i}`,
          title: `${p.numero} • Vivência ${d.label} (pref.)`,
          start: d.date,
          allDay: true,
          backgroundColor: "#7B2CBF",
          borderColor: "#7B2CBF",
          extendedProps: {
            detail: {
              title: `${p.numero} • Vivência (preferência)`,
              requestId: p.id,
              fields: [
                { label: "Data preferível", value: formatDate(d.date) },
                { label: "Série / Turma", value: d.label },
                { label: "Protocolo", value: p.numero },
                { label: "Escola", value: p.school_nome_snapshot },
                { label: "Região", value: regiaoEscolaLabel(requestRegiao(p)) },
                { label: "Profissionais atribuídos", value: assigneeNames(p.assignees) },
              ],
            },
          },
        });
      });
      if (p.data_preferivel_palestra) {
        const periods = (p.groups ?? []).map((g) => g.periodo).filter(Boolean);
        const palestraOk =
          periodoFilter === "todos" ||
          periods.length === 0 ||
          periods.includes(periodoFilter);
        if (palestraOk) {
          items.push({
            id: `${p.id}-pal`,
            title: `${p.numero} • Palestra (pref.)`,
            start: p.data_preferivel_palestra,
            allDay: true,
            backgroundColor: "#52C41A",
            borderColor: "#52C41A",
            extendedProps: {
              detail: {
                title: `${p.numero} • Palestra (preferência)`,
                requestId: p.id,
                fields: [
                  { label: "Data preferível", value: formatDate(p.data_preferivel_palestra) },
                  {
                    label: "Tema",
                    value: p.palestra_tema ? palestraTemaLabel(p.palestra_tema) : null,
                  },
                  { label: "Protocolo", value: p.numero },
                  { label: "Escola", value: p.school_nome_snapshot },
                  { label: "Região", value: regiaoEscolaLabel(requestRegiao(p)) },
                  { label: "Profissionais atribuídos", value: assigneeNames(p.assignees) },
                ],
              },
            },
          });
        }
      }
      return items;
    });

    return [...fromAppts, ...fromPrefs];
  }, [filteredAppointments, filteredPreferidas, periodoFilter]);

  const hasActiveFilters =
    regiaoFilter !== "todas" ||
    profFilter !== "todos" ||
    schoolFilter !== "todas" ||
    periodoFilter !== "todos";

  const clearFilters = () => {
    setRegiaoFilter("todas");
    setProfFilter("todos");
    setSchoolFilter("todas");
    setPeriodoFilter("todos");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda — Vivências"
        description="Datas preferíveis e agendamentos vinculados a solicitações de Vivências"
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="viv-agenda-filter-regiao">Região</Label>
            <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
              <SelectTrigger id="viv-agenda-filter-regiao">
                <SelectValue placeholder="Todas as regiões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as regiões</SelectItem>
                {regiaoEscolaOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viv-agenda-filter-prof">Profissional</Label>
            <Select value={profFilter} onValueChange={setProfFilter}>
              <SelectTrigger id="viv-agenda-filter-prof">
                <SelectValue placeholder="Todos os profissionais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os profissionais</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viv-agenda-filter-school">Escola</Label>
            <SchoolSearchSelect
              schools={schoolsWithDemands}
              value={schoolFilter === "todas" ? null : schoolFilter}
              onSelect={(school) => setSchoolFilter(school.id)}
              placeholder="Todas as escolas…"
              searchPlaceholder="Buscar escola…"
              emptyLabel="Nenhuma escola encontrada."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viv-agenda-filter-periodo">Período</Label>
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger id="viv-agenda-filter-periodo">
                <SelectValue placeholder="Todos os períodos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os períodos</SelectItem>
                {periodoOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge style={{ background: "#0F52BA" }} className="text-white">
          Agendado
        </Badge>
        <Badge style={{ background: "#7B2CBF" }} className="text-white">
          Preferência Vivência
        </Badge>
        <Badge style={{ background: "#52C41A" }} className="text-white">
          Preferência Palestra
        </Badge>
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">{selectedEvent.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedEvent.fields.slice(0, 2).map((f) => (
                    <DetailField key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
                {selectedEvent.fields.slice(2).map((f) => (
                  <DetailField key={f.label} label={f.label} value={f.value} />
                ))}
                {selectedEvent.requestId && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link
                      to="/modulo-vivencias/demandas/$id"
                      params={{ id: selectedEvent.requestId }}
                      onClick={() => setSelectedEvent(null)}
                    >
                      Ver demanda
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          {loadingAppt || loadingPref ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={viewHint}
              locale={ptBr}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              height="auto"
              events={events}
              eventClick={(info) => {
                const detail = info.event.extendedProps.detail as SelectedEvent | undefined;
                if (detail) setSelectedEvent(detail);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
