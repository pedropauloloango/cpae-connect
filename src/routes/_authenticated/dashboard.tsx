import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Inbox, Clock, CheckCircle2, Calendar, TrendingUp, AlertCircle, Users, School, MapPin,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, LabelList } from "recharts";
import { complaintTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fetchRequestIdsComAtendimentoNoMes, type DemandasFiltro } from "@/lib/demandas-filtros";
import type { HeatSchoolCount } from "@/components/dashboard/ComplaintsHeatMap";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

interface Counters { recebida: number; em_andamento: number; concluida: number; agendados_mes: number; total_escolas: number; total_profissionais: number; }

function Dashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth();

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
    enabled: !!user && !isAdmin && !authLoading,
  });

  const { data: counters } = useQuery<Counters>({
    queryKey: ["dashboard-counters", isAdmin, myProfId],
    enabled: !authLoading && (isAdmin || myProfId !== undefined),
    queryFn: async () => {
      let qRecebida = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "recebida");
      let qAndamento = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", ["distribuida", "em_andamento", "em_ajuste", "aguardando_aprovacao"]);
      let qConcluida = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "concluida");

      if (!isAdmin) {
        if (!myProfId) {
          return { recebida: 0, em_andamento: 0, concluida: 0, agendados_mes: 0, total_escolas: 0, total_profissionais: 0 };
        }
        qRecebida = qRecebida.eq("assigned_professional_id", myProfId);
        qAndamento = qAndamento.eq("assigned_professional_id", myProfId);
        qConcluida = qConcluida.eq("assigned_professional_id", myProfId);
      }

      const [r1, r2, r3, requestIdsMes] = await Promise.all([
        qRecebida,
        qAndamento,
        qConcluida,
        fetchRequestIdsComAtendimentoNoMes(isAdmin ? null : myProfId),
      ]);

      let total_escolas = 0;
      let total_profissionais = 0;
      if (isAdmin) {
        const [sc, pr] = await Promise.all([
          supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null),
          supabase.from("professionals").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ativo"),
        ]);
        total_escolas = sc.count ?? 0;
        total_profissionais = pr.count ?? 0;
      }

      return {
        recebida: r1.count ?? 0,
        em_andamento: r2.count ?? 0,
        concluida: r3.count ?? 0,
        agendados_mes: requestIdsMes.length,
        total_escolas,
        total_profissionais,
      };
    },
  });

  const { data: byComplaint = [] } = useQuery({
    queryKey: ["dash-by-complaint", isAdmin, myProfId],
    enabled: !authLoading && (isAdmin || myProfId !== undefined),
    queryFn: async () => {
      let qb = supabase.from("requests").select("tipo_queixa").is("deleted_at", null);
      if (!isAdmin) {
        if (!myProfId) return [];
        qb = qb.eq("assigned_professional_id", myProfId);
      }
      const { data } = await qb;
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { tipo_queixa: string | null }) => {
        if (!r.tipo_queixa) return;
        counts.set(r.tipo_queixa, (counts.get(r.tipo_queixa) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([k, v]) => ({ name: complaintTypeLabels[k] ?? k, value: v }));
    },
  });

  const { data: byRegion = [] } = useQuery({
    queryKey: ["dash-by-region"],
    enabled: !authLoading && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("requests").select("school:schools(regiao)").is("deleted_at", null);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { school: { regiao: string | null } | null }) => {
        const key = r.school?.regiao ?? "Sem região";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([name, value]) => ({ name, value })).slice(0, 8);
    },
  });

  const { data: bySchool = [] } = useQuery({
    queryKey: ["dash-by-school", myProfId],
    enabled: !authLoading && !isAdmin && myProfId !== undefined,
    queryFn: async () => {
      if (!myProfId) return [];
      const { data } = await supabase
        .from("requests")
        .select("school_nome_snapshot, school:schools(nome)")
        .is("deleted_at", null)
        .eq("assigned_professional_id", myProfId);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { school_nome_snapshot: string | null; school: { nome: string } | null }) => {
        const key = r.school?.nome ?? r.school_nome_snapshot ?? "Sem escola";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  });

  const barChartData = isAdmin ? byRegion : bySchool;

  const { data: heatSchools = [] } = useQuery({
    queryKey: ["dash-heatmap-schools", isAdmin, myProfId],
    enabled: !authLoading && (isAdmin || myProfId !== undefined),
    queryFn: async () => {
      let qb = supabase
        .from("requests")
        .select(
          "school_id, tipo_queixa, school:schools(id, nome, endereco, bairro, cep, regiao, latitude, longitude, geocode_status)",
        )
        .is("deleted_at", null)
        .not("school_id", "is", null);
      if (!isAdmin) {
        if (!myProfId) return [] as HeatSchoolCount[];
        qb = qb.eq("assigned_professional_id", myProfId);
      }
      const { data, error } = await qb;
      if (error) throw error;

      type SchoolRow = {
        id: string;
        nome: string;
        endereco: string | null;
        bairro: string | null;
        cep: string | null;
        regiao: string | null;
        latitude: number | null;
        longitude: number | null;
        geocode_status: string | null;
      };

      const byId = new Map<string, HeatSchoolCount>();
      for (const row of data ?? []) {
        const school = row.school as SchoolRow | SchoolRow[] | null;
        const s = Array.isArray(school) ? school[0] : school;
        if (!s?.id) continue;
        const tipo = (row as { tipo_queixa?: string | null }).tipo_queixa ?? "outros";
        const existing = byId.get(s.id);
        if (existing) {
          existing.count += 1;
          existing.byTipo[tipo] = (existing.byTipo[tipo] ?? 0) + 1;
        } else {
          byId.set(s.id, {
            id: s.id,
            nome: s.nome,
            endereco: s.endereco,
            bairro: s.bairro,
            cep: s.cep,
            regiao: s.regiao,
            latitude: s.latitude,
            longitude: s.longitude,
            geocode_status: s.geocode_status,
            count: 1,
            byTipo: { [tipo]: 1 },
          });
        }
      }
      return [...byId.values()].sort((a, b) => b.count - a.count);
    },
  });

  const { data: monthly = [] } = useQuery({
    queryKey: ["dash-monthly", isAdmin, myProfId],
    enabled: !authLoading && (isAdmin || myProfId !== undefined),
    queryFn: async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
      let qb = supabase.from("requests").select("created_at").is("deleted_at", null).gte("created_at", since.toISOString());
      if (!isAdmin) {
        if (!myProfId) return [];
        qb = qb.eq("assigned_professional_id", myProfId);
      }
      const { data } = await qb;
      const buckets = new Map<string, number>();
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0); }
      (data ?? []).forEach((r: { created_at: string }) => {
        const d = new Date(r.created_at); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return Array.from(buckets.entries()).map(([k, v]) => ({ mes: monthNames[Number(k.split("-")[1]) - 1], total: v }));
    },
  });

  const COLORS = ["oklch(0.42 0.14 250)", "oklch(0.62 0.13 200)", "oklch(0.62 0.15 155)", "oklch(0.78 0.15 75)", "oklch(0.55 0.22 25)", "oklch(0.5 0.1 280)"];

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Dashboard Executivo" : "Meu painel"}
        description={
          isAdmin
            ? "Indicadores em tempo real do módulo de Acolhimento."
            : "Indicadores das suas demandas e atendimentos."
        }
      />

      <div className={`grid items-stretch gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        <Kpi
          label="Solicitações Recebidas"
          value={counters?.recebida ?? 0}
          sub="Total recebido"
          icon={Inbox}
          iconBg="bg-[#FAF5FF] text-[#7B2CBF]"
          filtro="recebida"
        />
        <Kpi
          label="Em Andamento"
          value={counters?.em_andamento ?? 0}
          sub="Em atendimento"
          icon={Clock}
          iconBg="bg-[#FFFBEB] text-[#F7B500]"
          filtro="em_atendimento"
        />
        <Kpi
          label="Concluídas"
          value={counters?.concluida ?? 0}
          sub="Finalizadas"
          icon={CheckCircle2}
          iconBg="bg-[#F2FFF6] text-[#52C41A]"
          filtro="concluida"
        />
        <Kpi
          label="Atendimentos no Mês"
          value={counters?.agendados_mes ?? 0}
          sub="Demandas com agenda no mês"
          icon={Calendar}
          iconBg="bg-[#EAF2FF] text-[#0F52BA]"
          filtro="atendimentos_mes"
        />
        {isAdmin && (
          <>
            <Kpi label="Escolas Ativas" value={counters?.total_escolas ?? 0} sub="Cadastradas" icon={School} iconBg="bg-[#EAF2FF] text-[#0F52BA]" />
            <Kpi label="Profissionais Ativos" value={counters?.total_profissionais ?? 0} sub="Na equipe" icon={Users} iconBg="bg-[#FAF5FF] text-[#D633C6]" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="cpae-card border-0 shadow-none">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#0F52BA]" /> Evolução Mensal</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 240)" />
                <XAxis dataKey="mes" stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="oklch(0.42 0.14 250)" strokeWidth={2.5} dot={{ r: 3 }}>
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={8}
                    className="fill-[#0F172A] text-[11px] font-semibold"
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="cpae-card border-0 shadow-none">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-[#0F52BA]" /> Distribuição por Queixa</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byComplaint}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine
                >
                  {byComplaint.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="cpae-card border-0 shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {!isAdmin && <School className="h-4 w-4" />}
              {isAdmin ? "Solicitações por Região" : "Minhas solicitações por escolas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 240)" />
                <XAxis
                  dataKey="name"
                  stroke="oklch(0.5 0.02 250)"
                  fontSize={12}
                  interval={0}
                  angle={isAdmin ? 0 : -25}
                  textAnchor={isAdmin ? "middle" : "end"}
                  height={isAdmin ? 30 : 70}
                />
                <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="oklch(0.62 0.13 200)" radius={[6, 6, 0, 0]}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    offset={6}
                    className="fill-[#0F172A] text-[11px] font-semibold"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="cpae-card mt-4 border-0 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-[#0F52BA]" />
            Mapa de calor — queixas por escola
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Intensidade com base nas coordenadas cadastradas da escola e na quantidade de demandas.
            Escolas sem lat/lng ficam de fora até o preenchimento em Escolas.
          </p>
        </CardHeader>
        <CardContent>
          <ClientComplaintsHeatMap schools={heatSchools} />
        </CardContent>
      </Card>
    </div>
  );
}

function ClientComplaintsHeatMap({ schools }: { schools: HeatSchoolCount[] }) {
  const [MapComp, setMapComp] = useState<ComponentType<{ schools: HeatSchoolCount[] }> | null>(null);

  useEffect(() => {
    let active = true;
    void import("@/components/dashboard/ComplaintsHeatMap").then((mod) => {
      if (active) setMapComp(() => mod.ComplaintsHeatMap);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!MapComp) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Carregando mapa…
      </div>
    );
  }

  return <MapComp schools={schools} />;
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  filtro,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  filtro?: DemandasFiltro;
}) {
  const card = (
    <Card className={cn("cpae-card h-full border-0 shadow-none", filtro && "cursor-pointer")}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-h-[2.5rem] min-w-0 text-xs font-medium leading-snug text-[#64748B]">
            {label}
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-3xl font-bold tabular-nums text-[#0F172A]">{value}</div>
          <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (!filtro) return card;

  return (
    <Link
      to="/demandas"
      search={{ filtro }}
      className="block h-full rounded-xl outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0F52BA]/40"
      title={`Ver demandas: ${label}`}
    >
      {card}
    </Link>
  );
}

