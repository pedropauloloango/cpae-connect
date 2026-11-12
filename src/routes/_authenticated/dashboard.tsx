import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Inbox, Clock, CheckCircle2, Calendar, TrendingUp, AlertCircle, Users, School, MapPin,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid, LabelList } from "recharts";
import {
  situacaoObservadaChartLabel,
  situacoesFromRequest,
} from "@/lib/acolhimento-options";
import { cn } from "@/lib/utils";
import type { DemandasFiltro } from "@/lib/demandas-filtros";
import {
  aplicarFiltros,
  evolucaoMensal,
  fetchAllPages,
  FILTROS_DASHBOARD_PADRAO,
  intervaloDoMes,
  mesKeyDeIso,
  mesLabel,
  mesReferencia,
  regiaoDoRegistro,
  type DashboardFiltros,
} from "@/lib/dashboard-filtros";
import type { HeatSchoolCount } from "@/components/dashboard/ComplaintsHeatMap";
import { DashboardFiltrosBar } from "@/components/dashboard/DashboardFiltrosBar";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

interface Counters { recebida: number; em_andamento: number; concluida: number; agendados_mes: number; total_escolas: number; total_profissionais: number; }

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

interface RequestRow {
  id: string;
  status: string;
  mes: string;
  regiao: string;
  escola: string;
  situacoes: string[];
  school: SchoolRow | null;
}

function formatPercent(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

function Dashboard() {
  const navigate = useNavigate();
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

  const scopeReady = !authLoading && (isAdmin || myProfId !== undefined);
  const [filtros, setFiltros] = useState<DashboardFiltros>(FILTROS_DASHBOARD_PADRAO);

  const { data: base = [] } = useQuery<RequestRow[]>({
    queryKey: ["dash-base", isAdmin, myProfId],
    enabled: scopeReady,
    queryFn: async () => {
      if (!isAdmin && !myProfId) return [];
      const rows = await fetchAllPages((from, to) => {
        let qb = supabase
          .from("requests")
          .select(
            "id, status, created_at, regiao_escola, situacao_observada, tipo_queixa, school_nome_snapshot, school:schools(id, nome, endereco, bairro, cep, regiao, latitude, longitude, geocode_status)",
          )
          .is("deleted_at", null);
        if (!isAdmin) qb = qb.eq("assigned_professional_id", myProfId!);
        return qb.order("id").range(from, to);
      });
      return rows.map((r) => {
        const school = (Array.isArray(r.school) ? r.school[0] : r.school) as SchoolRow | null;
        return {
          id: r.id,
          status: r.status,
          mes: mesKeyDeIso(r.created_at),
          regiao: regiaoDoRegistro(r.regiao_escola, school?.regiao),
          escola: school?.nome ?? r.school_nome_snapshot ?? "Sem escola",
          situacoes: situacoesFromRequest(r),
          school,
        };
      });
    },
  });

  const mesAtendimentos = mesReferencia(filtros);

  const { data: atendidosNoMes = [] } = useQuery({
    queryKey: ["dash-atendidos-mes", isAdmin, myProfId, mesAtendimentos],
    enabled: scopeReady,
    queryFn: async () => {
      if (!isAdmin && !myProfId) return [];
      const { inicio, fim } = intervaloDoMes(mesAtendimentos);
      const rows = await fetchAllPages((from, to) => {
        let qb = supabase
          .from("appointments")
          .select("request_id")
          .gte("inicio", inicio)
          .lt("inicio", fim)
          .is("vivencia_request_id", null)
          .not("request_id", "is", null);
        if (!isAdmin) qb = qb.eq("professional_id", myProfId!);
        return qb.order("id").range(from, to);
      });
      return [...new Set(rows.map((r) => r.request_id).filter((id): id is string => Boolean(id)))];
    },
  });

  const { data: totais } = useQuery({
    queryKey: ["dash-totais"],
    enabled: !authLoading && isAdmin,
    queryFn: async () => {
      const [sc, pr] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("professionals").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ativo"),
      ]);
      return { escolas: sc.count ?? 0, profissionais: pr.count ?? 0 };
    },
  });

  const painel = useMemo(() => {
    const filtrados = aplicarFiltros(base, filtros);
    const daRegiao = aplicarFiltros(base, filtros, { ignorarPeriodo: true });
    const atendidos = new Set(atendidosNoMes);
    const emAndamento = ["distribuida", "em_andamento", "em_ajuste", "aguardando_aprovacao"];

    const counters: Counters = {
      recebida: filtrados.filter((r) => r.status === "recebida").length,
      em_andamento: filtrados.filter((r) => emAndamento.includes(r.status)).length,
      concluida: filtrados.filter((r) => r.status === "concluida").length,
      agendados_mes: daRegiao.filter((r) => atendidos.has(r.id)).length,
      total_escolas: totais?.escolas ?? 0,
      total_profissionais: totais?.profissionais ?? 0,
    };

    const queixaCounts = new Map<string, number>();
    const regiaoCounts = new Map<string, number>();
    const escolaCounts = new Map<string, number>();
    const heatById = new Map<string, HeatSchoolCount>();
    filtrados.forEach((r) => {
      r.situacoes.forEach((key) => queixaCounts.set(key, (queixaCounts.get(key) ?? 0) + 1));
      regiaoCounts.set(r.regiao, (regiaoCounts.get(r.regiao) ?? 0) + 1);
      escolaCounts.set(r.escola, (escolaCounts.get(r.escola) ?? 0) + 1);

      const s = r.school;
      if (!s?.id) return;
      const keys = r.situacoes.length > 0 ? r.situacoes : ["outro"];
      const heat =
        heatById.get(s.id) ??
        heatById
          .set(s.id, {
            id: s.id,
            nome: s.nome,
            endereco: s.endereco,
            bairro: s.bairro,
            cep: s.cep,
            regiao: s.regiao,
            latitude: s.latitude,
            longitude: s.longitude,
            geocode_status: s.geocode_status,
            count: 0,
            byTipo: {},
          })
          .get(s.id)!;
      heat.count += 1;
      for (const tipo of keys) heat.byTipo[tipo] = (heat.byTipo[tipo] ?? 0) + 1;
    });

    const queixas = Array.from(queixaCounts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
    );
    const totalQueixas = queixas.reduce((sum, [, v]) => sum + v, 0);

    return {
      counters,
      byComplaint: queixas.map(([k, v]) => ({
        key: k,
        name: situacaoObservadaChartLabel(k),
        value: v,
        percent: totalQueixas > 0 ? v / totalQueixas : 0,
      })),
      byRegion: Array.from(regiaoCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      bySchool: Array.from(escolaCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      heatSchools: [...heatById.values()].sort((a, b) => b.count - a.count),
      monthly: evolucaoMensal(daRegiao, filtros),
    };
  }, [base, atendidosNoMes, totais, filtros]);

  const { counters, byComplaint, byRegion, bySchool, heatSchools, monthly } = painel;
  const barChartData = isAdmin ? byRegion : bySchool;

  const COLORS = [
    "oklch(0.42 0.14 250)",
    "oklch(0.62 0.13 200)",
    "oklch(0.62 0.15 155)",
    "oklch(0.78 0.15 75)",
    "oklch(0.55 0.22 25)",
    "oklch(0.5 0.1 280)",
    "oklch(0.58 0.16 30)",
    "oklch(0.48 0.12 320)",
    "oklch(0.55 0.1 180)",
    "oklch(0.45 0.08 80)",
    "oklch(0.4 0.12 20)",
  ];

  const openDemandasByQueixa = (key: string | undefined) => {
    if (!key) return;
    void navigate({
      to: "/demandas",
      search: { filtro: undefined, queixa: key },
    });
  };

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

      <DashboardFiltrosBar filtros={filtros} onChange={setFiltros} registros={base} />

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
          sub={`Demandas com agenda em ${mesLabel(mesAtendimentos)}`}
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#0F52BA]" /> Distribuição por Queixa
            </CardTitle>
            <p className="text-sm text-muted-foreground">Clique em uma barra para ver as demandas.</p>
          </CardHeader>
          <CardContent className="h-[28rem] overflow-y-auto">
            <div style={{ height: Math.max(400, byComplaint.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byComplaint.map((item) => ({ ...item, rotulo: `${item.value} (${formatPercent(item.percent)})` }))}
                  layout="vertical"
                  margin={{ top: 4, right: 64, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" hide domain={[0, (max: number) => Math.max(max * 1.15, 1)]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    interval={0}
                    stroke="oklch(0.5 0.02 250)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: string) => (value.length > 28 ? `${value.slice(0, 27)}…` : value)}
                  />
                  <Tooltip
                    cursor={{ fill: "oklch(0.96 0.01 250)" }}
                    formatter={(value, _name, item) => {
                      const pct = (item.payload as { percent?: number } | undefined)?.percent ?? 0;
                      return [`${value} (${formatPercent(pct)})`, "Demandas"];
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={22}
                    style={{ cursor: "pointer" }}
                    onClick={(data) => {
                      const key =
                        (data as { key?: string; payload?: { key?: string } } | undefined)?.payload?.key ??
                        (data as { key?: string } | undefined)?.key;
                      openDemandasByQueixa(key);
                    }}
                  >
                    {byComplaint.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="rotulo"
                      position="right"
                      offset={6}
                      className="fill-[#0F172A] text-[11px] font-semibold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
      search={{ filtro, queixa: undefined }}
      className="block h-full rounded-xl outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0F52BA]/40"
      title={`Ver demandas: ${label}`}
    >
      {card}
    </Link>
  );
}

