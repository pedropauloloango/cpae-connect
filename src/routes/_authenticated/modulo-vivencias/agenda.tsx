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
import { palestraTemaLabel, vivenciaTemaLabel } from "@/lib/vivencias-options";
import { formatHoraInicio, vivenciaPreferredAgendaSlot } from "@/lib/vivencia-schedule";
import { useAuth } from "@/lib/auth";
import { Loader2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/agenda")({
  component: VivenciasAgenda,
});

type PreferidaGroup = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[] | null;
  data_preferivel: string | null;
  hora_inicio: string | null;
};

type PreferidaPalestra = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  palestra_tema: string;
  data_preferivel: string | null;
  hora_inicio: string | null;
};

type Assignee = {
  professional_id?: string;
  professional: { id?: string; nome: string } | null;
};

/** Primeiro e último nome para caber no calendário. */
function shortPersonName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function assigneeNames(assignees: Assignee[] | null | undefined): string | null {
  const names = (assignees ?? []).map((a) => a.professional?.nome).filter((n): n is string => !!n);
  return names.length > 0 ? names.join(", ") : null;
}

function shortAssigneeNames(assignees: Assignee[] | null | undefined): string | null {
  const names = (assignees ?? [])
    .map((a) => shortPersonName(a.professional?.nome))
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(", ") : null;
}

function agendaEventTitle(opts: {
  isAdmin: boolean;
  fallback: string;
  professionals: string | null;
  kind: string;
}): string {
  if (!opts.isAdmin) return opts.fallback;
  const who = opts.professionals?.trim() || "Sem atribuição";
  return `${who} • ${opts.kind}`;
}

function agendaEventTooltip(opts: {
  professionals: string | null;
  school: string | null | undefined;
  kind: string;
  hora?: string | null;
}): string {
  const who = opts.professionals?.trim() || "Sem atribuição";
  const school = opts.school?.trim() || "Escola não informada";
  const parts = [who, school, opts.kind];
  if (opts.hora?.trim()) parts.push(opts.hora.trim());
  return parts.join(" • ");
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
  hora_inicio_palestra: string | null;
  palestra_tema: string | null;
  school: { id: string; nome: string; regiao: string | null; tipo_escola: "escola" | "emei" | "cpae" | "semed" | "outros" | null } | null;
  groups: PreferidaGroup[] | null;
  palestras: PreferidaPalestra[] | null;
  assignees: Assignee[] | null;
};

function vivenciaDates(
  p: Preferida,
): {
  label: string;
  date: string;
  periodo: string | null;
  hora_inicio: string | null;
  temas: string[];
}[] {
  const items: {
    label: string;
    date: string;
    periodo: string | null;
    hora_inicio: string | null;
    temas: string[];
  }[] = [];
  for (const g of p.groups ?? []) {
    if (g.data_preferivel) {
      items.push({
        label: `${g.aluno_serie} ${g.aluno_turma}`,
        date: g.data_preferivel,
        periodo: g.periodo ?? null,
        hora_inicio: g.hora_inicio ?? null,
        temas: g.temas ?? [],
      });
    }
  }
  if (items.length === 0 && p.data_preferivel_vivencia) {
    items.push({
      label: "Vivência",
      date: p.data_preferivel_vivencia,
      periodo: null,
      hora_inicio: null,
      temas: [],
    });
  }
  return items;
}

function formatTemas(temas: string[] | null | undefined): string | null {
  if (!temas?.length) return null;
  return temas.map((t) => vivenciaTemaLabel(t)).join("; ");
}

function palestraDates(
  p: Preferida,
): {
  label: string;
  date: string;
  periodo: string | null;
  hora_inicio: string | null;
  palestra_tema: string | null;
}[] {
  const items: {
    label: string;
    date: string;
    periodo: string | null;
    hora_inicio: string | null;
    palestra_tema: string | null;
  }[] = [];

  for (const pal of p.palestras ?? []) {
    if (pal.data_preferivel) {
      items.push({
        label: `${pal.aluno_serie} ${pal.aluno_turma}`,
        date: pal.data_preferivel,
        periodo: pal.periodo ?? null,
        hora_inicio: pal.hora_inicio ?? null,
        palestra_tema: pal.palestra_tema ?? null,
      });
    }
  }

  if (items.length === 0 && p.data_preferivel_palestra) {
    items.push({
      label: "Palestra",
      date: p.data_preferivel_palestra,
      periodo: null,
      hora_inicio: p.hora_inicio_palestra ?? null,
      palestra_tema: p.palestra_tema ?? null,
    });
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
  modulo: string | null;
  school_id: string | null;
  vivencia_request_id: string | null;
  professional: { id: string; nome: string } | null;
  school: { id: string; nome: string; regiao: string | null; tipo_escola: "escola" | "emei" | "cpae" | "semed" | "outros" | null } | null;
  vivencia_request: {
    id: string;
    numero: string;
    school_id: string | null;
    school_nome_snapshot: string | null;
    regiao_escola: string | null;
    school: { id: string; nome: string; regiao: string | null; tipo_escola: "escola" | "emei" | "cpae" | "semed" | "outros" | null } | null;
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
  extendedProps: { detail: SelectedEvent; tooltip: string };
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
  const { isAdmin } = useAuth();
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
          "id, numero, school_id, school_nome_snapshot, regiao_escola, data_preferivel_vivencia, data_preferivel_palestra, hora_inicio_palestra, palestra_tema, school:schools(id, nome, regiao, tipo_escola), groups:vivencia_request_groups(aluno_serie, aluno_turma, periodo, temas, data_preferivel, hora_inicio), palestras:vivencia_request_palestras(aluno_serie, aluno_turma, periodo, palestra_tema, data_preferivel, hora_inicio), assignees:vivencia_request_assignees(professional_id, professional:professionals(id, nome))",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data ?? []) as unknown as Preferida[]).filter(
        (p) => vivenciaDates(p).length > 0 || palestraDates(p).length > 0,
      );
    },
  });

  const { data: appointments = [], isLoading: loadingAppt } = useQuery({
    queryKey: ["vivencias-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, titulo, tipo, inicio, fim, modulo, school_id, vivencia_request_id, professional:professionals(id, nome), school:schools(id, nome, regiao, tipo_escola), vivencia_request:vivencia_requests(id, numero, school_id, school_nome_snapshot, regiao_escola, school:schools(id, nome, regiao, tipo_escola), groups:vivencia_request_groups(periodo), assignees:vivencia_request_assignees(professional_id, professional:professionals(id, nome)))",
        )
        .or("vivencia_request_id.not.is.null,modulo.eq.vivencias")
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
      const school = a.vivencia_request?.school ?? a.school;
      if (school?.id) {
        byId.set(school.id, {
          id: school.id,
          nome: school.nome,
          regiao: school.regiao,
          tipo_escola: school.tipo_escola ?? "escola",
        });
      } else if (a.school_id && a.school?.nome) {
        byId.set(a.school_id, {
          id: a.school_id,
          nome: a.school.nome,
          regiao: a.school.regiao,
          tipo_escola: a.school.tipo_escola ?? "escola",
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
        periodos: [...(p.groups ?? []).map((g) => g.periodo), ...(p.palestras ?? []).map((pal) => pal.periodo)].filter(Boolean),
      }),
    );
  }, [preferidas, regiaoFilter, schoolFilter, profFilter, periodoFilter, schoolsWithDemands]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const req = a.vivencia_request;
      const school = req?.school ?? a.school;
      const isStandaloneVisita = a.modulo === "vivencias" && !a.vivencia_request_id;
      const professionalIds = [
        ...(a.professional?.id ? [a.professional.id] : []),
        ...assigneeIds(req?.assignees),
      ];
      return matchesCommonFilters({
        regiao: requestRegiao(
          req ?? { regiao_escola: school?.regiao ?? null, school: school ?? null },
        ),
        schoolId: req?.school_id ?? req?.school?.id ?? a.school_id ?? school?.id ?? null,
        schoolNome: req?.school_nome_snapshot ?? school?.nome ?? null,
        professionalIds,
        // Visitas técnicas avulsas não têm período escolar — não filtrar por período
        periodos: isStandaloneVisita
          ? periodoFilter === "todos"
            ? []
            : [periodoFilter]
          : (req?.groups ?? []).map((g) => g.periodo).filter(Boolean),
      });
    });
  }, [appointments, regiaoFilter, schoolFilter, profFilter, periodoFilter, schoolsWithDemands]);

  const events = useMemo(() => {
    const fromAppts: CalendarEvent[] = filteredAppointments.map((a) => {
      const isVisitaTecnica = a.modulo === "vivencias" && !a.vivencia_request_id;
      const schoolNome =
        a.vivencia_request?.school_nome_snapshot ?? a.school?.nome ?? null;
      const apptProf =
        shortPersonName(a.professional?.nome) ??
        shortAssigneeNames(a.vivencia_request?.assignees);
      const detail: SelectedEvent = {
        title: a.vivencia_request
          ? `${a.vivencia_request.numero} • ${a.titulo}`
          : a.titulo,
        requestId: a.vivencia_request_id,
        fields: [
          { label: "Início", value: new Date(a.inicio).toLocaleString("pt-BR") },
          { label: "Término", value: new Date(a.fim).toLocaleString("pt-BR") },
          { label: "Tipo", value: isVisitaTecnica ? "Visita técnica" : a.tipo },
          { label: "Profissional", value: a.professional?.nome ?? null },
          { label: "Protocolo", value: a.vivencia_request?.numero ?? null },
          { label: "Escola", value: schoolNome },
          {
            label: "Região",
            value: regiaoEscolaLabel(
              requestRegiao(
                a.vivencia_request ?? {
                  regiao_escola: a.school?.regiao ?? null,
                  school: a.school,
                },
              ),
            ),
          },
          {
            label: "Profissionais atribuídos",
            value: assigneeNames(a.vivencia_request?.assignees),
          },
        ],
      };
      const color = isVisitaTecnica ? "#EA580C" : "#0F52BA";
      const kind = isVisitaTecnica
        ? "Visita técnica"
        : a.vivencia_request
          ? "Agendamento"
          : a.titulo;
      return {
        id: a.id,
        title: agendaEventTitle({
          isAdmin,
          fallback: detail.title,
          professionals: apptProf,
          kind,
        }),
        start: a.inicio,
        end: a.fim,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          detail,
          tooltip: agendaEventTooltip({
            professionals: apptProf,
            school: schoolNome,
            kind,
            hora: new Date(a.inicio).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }),
        },
      };
    });

    const fromPrefs = filteredPreferidas.flatMap((p) => {
      const items: CalendarEvent[] = [];
      const profs = shortAssigneeNames(p.assignees);
      vivenciaDates(p).forEach((d, i) => {
        if (periodoFilter !== "todos" && d.periodo && d.periodo !== periodoFilter) return;
        if (periodoFilter !== "todos" && !d.periodo) return;
        const slot = vivenciaPreferredAgendaSlot(d.date, d.hora_inicio);
        const horaLabel = formatHoraInicio(d.hora_inicio);
        const fallback = `${p.numero} • Vivência ${d.label} (pref.)`;
        const kind = `Vivência ${d.label}`;
        items.push({
          id: `${p.id}-viv-${i}`,
          title: agendaEventTitle({
            isAdmin,
            fallback,
            professionals: profs,
            kind,
          }),
          start: slot.start,
          end: slot.end,
          allDay: slot.allDay,
          backgroundColor: "#7B2CBF",
          borderColor: "#7B2CBF",
          extendedProps: {
            detail: {
              title: `${p.numero} • Vivência (preferência)`,
              requestId: p.id,
              fields: [
                { label: "Data preferível", value: formatDate(d.date) },
                {
                  label: "Horário",
                  value:
                    horaLabel === "—"
                      ? "Dia inteiro (sem horário)"
                      : `${horaLabel} — duração 1h`,
                },
                { label: "Série / Turma", value: d.label },
                { label: "Temas da vivência", value: formatTemas(d.temas) },
                { label: "Protocolo", value: p.numero },
                { label: "Escola", value: p.school_nome_snapshot },
                { label: "Região", value: regiaoEscolaLabel(requestRegiao(p)) },
                { label: "Profissionais atribuídos", value: assigneeNames(p.assignees) },
              ],
            },
            tooltip: agendaEventTooltip({
              professionals: profs,
              school: p.school_nome_snapshot,
              kind,
              hora: horaLabel === "—" ? null : horaLabel,
            }),
          },
        });
      });
      palestraDates(p).forEach((pal, i) => {
        const palestraOk = periodoFilter === "todos" || !pal.periodo || pal.periodo === periodoFilter;
        if (palestraOk) {
          const slot = vivenciaPreferredAgendaSlot(
            pal.date,
            pal.hora_inicio,
          );
          const horaLabel = formatHoraInicio(pal.hora_inicio);
          const fallback = `${p.numero} • Palestra ${pal.label} (pref.)`;
          const kind = "Palestra";
          items.push({
            id: `${p.id}-pal-${i}`,
            title: agendaEventTitle({
              isAdmin,
              fallback,
              professionals: profs,
              kind,
            }),
            start: slot.start,
            end: slot.end,
            allDay: slot.allDay,
            backgroundColor: "#52C41A",
            borderColor: "#52C41A",
            extendedProps: {
              detail: {
                title: `${p.numero} • Palestra (preferência)`,
                requestId: p.id,
                fields: [
                  { label: "Data preferível", value: formatDate(pal.date) },
                  {
                    label: "Horário",
                    value:
                      horaLabel === "—"
                        ? "Dia inteiro (sem horário)"
                        : `${horaLabel} — duração 1h`,
                  },
                  { label: "Série / Turma", value: pal.label },
                  { label: "Período", value: pal.periodo ? (periodoOptions.find((o) => o.value === pal.periodo)?.label ?? pal.periodo) : null },
                  {
                    label: "Tema da palestra",
                    value: pal.palestra_tema ? palestraTemaLabel(pal.palestra_tema) : null,
                  },
                  { label: "Protocolo", value: p.numero },
                  { label: "Escola", value: p.school_nome_snapshot },
                  { label: "Região", value: regiaoEscolaLabel(requestRegiao(p)) },
                  { label: "Profissionais atribuídos", value: assigneeNames(p.assignees) },
                ],
              },
              tooltip: agendaEventTooltip({
                professionals: profs,
                school: p.school_nome_snapshot,
                kind,
                hora: horaLabel === "—" ? null : horaLabel,
              }),
            },
          });
        }
      });
      return items;
    });

    return [...fromAppts, ...fromPrefs];
  }, [filteredAppointments, filteredPreferidas, periodoFilter, isAdmin]);

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
              eventDidMount={(info) => {
                const tip = info.event.extendedProps.tooltip as string | undefined;
                if (tip) info.el.setAttribute("title", tip);
              }}
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
