import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Inbox,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Users,
  School,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  LabelList,
} from "recharts";
import { periodoLabels } from "@/lib/acolhimento-options";
import { palestraTemaLabel, vivenciaTemaLabel } from "@/lib/vivencias-options";
import {
  VIVENCIAS_EM_ATENDIMENTO_STATUSES,
  type VivenciasDemandasFiltro,
} from "@/lib/vivencias-demandas-filtros";
import {
  aplicarFiltros,
  evolucaoMensal,
  fetchAllPages,
  FILTROS_DASHBOARD_PADRAO,
  mesKeyDeIso,
  regiaoDoRegistro,
  type DashboardFiltros,
} from "@/lib/dashboard-filtros";
import { DashboardFiltrosBar } from "@/components/dashboard/DashboardFiltrosBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/dashboard")({
  component: VivenciasDashboard,
});

interface Counters {
  recebida: number;
  em_andamento: number;
  concluida: number;
  relatorios_aguardando: number;
  total_escolas: number;
  total_profissionais: number;
}

interface VivRequestRow {
  id: string;
  status: string;
  mes: string;
  regiao: string;
  escola: string;
  palestraTema: string | null;
}

function VivenciasDashboard() {
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

  const scopeReady = isAdmin || myProfId !== undefined;
  const [filtros, setFiltros] = useState<DashboardFiltros>(FILTROS_DASHBOARD_PADRAO);

  const { data: base = [] } = useQuery<VivRequestRow[]>({
    queryKey: ["viv-dash-base", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];
      const rows = await fetchAllPages((from, to) =>
        supabase
          .from("vivencia_requests")
          .select("id, status, created_at, regiao_escola, palestra_tema, school_nome_snapshot, school:schools(nome, regiao)")
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      );
      const escopo = isAdmin ? null : new Set(myRequestIds);
      return rows
        .filter((r) => !escopo || escopo.has(r.id))
        .map((r) => {
          const school = r.school as { nome: string | null; regiao: string | null } | null;
          return {
            id: r.id,
            status: r.status,
            mes: mesKeyDeIso(r.created_at),
            regiao: regiaoDoRegistro(r.regiao_escola, school?.regiao),
            escola: school?.nome ?? r.school_nome_snapshot ?? "Sem escola",
            palestraTema: r.palestra_tema,
          };
        });
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["viv-dash-groups"],
    enabled: !authLoading && scopeReady,
    queryFn: () =>
      fetchAllPages((from, to) =>
        supabase
          .from("vivencia_request_groups")
          .select("vivencia_request_id, periodo, temas")
          .order("id")
          .range(from, to),
      ),
  });

  const { data: palestras = [] } = useQuery({
    queryKey: ["viv-dash-palestras"],
    enabled: !authLoading && scopeReady,
    queryFn: () =>
      fetchAllPages((from, to) =>
        supabase
          .from("vivencia_request_palestras")
          .select("vivencia_request_id, palestra_tema")
          .order("id")
          .range(from, to),
      ),
  });

  const { data: relatorios = [] } = useQuery({
    queryKey: ["viv-dash-relatorios", isAdmin],
    enabled: !authLoading && scopeReady,
    queryFn: () =>
      fetchAllPages((from, to) => {
        const q = supabase.from("vivencia_reports").select("vivencia_request_id");
        return (
          isAdmin
            ? q.eq("status", "aguardando_aprovacao")
            : q.in("status", ["correcao_solicitada", "rejeitado", "rascunho"])
        )
          .order("id")
          .range(from, to);
      }),
  });

  const { data: totais } = useQuery({
    queryKey: ["viv-dash-totais"],
    enabled: !authLoading && isAdmin,
    queryFn: async () => {
      const [sc, pr] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("status", "ativo")
          .eq("atende_vivencias", true),
      ]);
      return { escolas: sc.count ?? 0, profissionais: pr.count ?? 0 };
    },
  });

  const painel = useMemo(() => {
    const filtrados = aplicarFiltros(base, filtros);
    const ids = new Set(filtrados.map((r) => r.id));
    const emAndamento = VIVENCIAS_EM_ATENDIMENTO_STATUSES as readonly string[];

    const counters: Counters = {
      recebida: filtrados.filter((r) => r.status === "recebida").length,
      em_andamento: filtrados.filter((r) => emAndamento.includes(r.status)).length,
      concluida: filtrados.filter((r) => r.status === "concluida").length,
      relatorios_aguardando: relatorios.filter((r) => r.vivencia_request_id && ids.has(r.vivencia_request_id)).length,
      total_escolas: totais?.escolas ?? 0,
      total_profissionais: totais?.profissionais ?? 0,
    };

    const periodoCounts = new Map<string, number>();
    const temaCounts = new Map<string, number>();
    groups.forEach((g) => {
      if (!ids.has(g.vivencia_request_id)) return;
      if (g.periodo?.trim()) periodoCounts.set(g.periodo, (periodoCounts.get(g.periodo) ?? 0) + 1);
      new Set(g.temas ?? []).forEach((t) => {
        if (!t?.trim()) return;
        const nome = vivenciaTemaLabel(t);
        temaCounts.set(nome, (temaCounts.get(nome) ?? 0) + 1);
      });
    });
    const byPeriodo = Array.from(periodoCounts.entries()).map(([k, v]) => ({
      name: periodoLabels[k] ?? k,
      value: v,
    }));

    const palestraCounts = new Map<string, number>();
    const somarPalestra = (tema: string | null) => {
      if (!tema) return;
      const nome = palestraTemaLabel(tema);
      palestraCounts.set(nome, (palestraCounts.get(nome) ?? 0) + 1);
    };
    filtrados.forEach((r) => somarPalestra(r.palestraTema));
    palestras.forEach((p) => {
      if (ids.has(p.vivencia_request_id)) somarPalestra(p.palestra_tema);
    });

    const regiaoCounts = new Map<string, number>();
    const escolaCounts = new Map<string, number>();
    filtrados.forEach((r) => {
      regiaoCounts.set(r.regiao, (regiaoCounts.get(r.regiao) ?? 0) + 1);
      escolaCounts.set(r.escola, (escolaCounts.get(r.escola) ?? 0) + 1);
    });

    return {
      counters,
      byPeriodo,
      byTema: rankingComPercentual(temaCounts),
      byPalestra: rankingComPercentual(palestraCounts),
      byRegion: rankingComPercentual(regiaoCounts).slice(0, 8),
      bySchool: rankingComPercentual(escolaCounts).slice(0, 10),
      monthly: evolucaoMensal(aplicarFiltros(base, filtros, { ignorarPeriodo: true }), filtros),
    };
  }, [base, groups, palestras, relatorios, totais, filtros]);

  const { counters, byPeriodo, byTema, byPalestra, byRegion, bySchool, monthly } = painel;
  const barChartData = isAdmin ? byRegion : bySchool;

  const COLORS = [
    "oklch(0.55 0.14 160)",
    "oklch(0.62 0.13 145)",
    "oklch(0.72 0.12 130)",
    "oklch(0.48 0.1 180)",
    "oklch(0.65 0.15 100)",
    "oklch(0.5 0.08 200)",
  ];

  const pieData = byPeriodo.length > 0 ? byPeriodo : byPalestra;
  const pieTitle = byPeriodo.length > 0 ? "Distribuição por Período" : "Palestras solicitadas";

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Dashboard — Vivências" : "Meu painel — Vivências"}
        description={
          isAdmin
            ? "Indicadores em tempo real do módulo de Vivências e Palestras."
            : "Indicadores das suas demandas de vivências atribuídas."
        }
      />

      <DashboardFiltrosBar filtros={filtros} onChange={setFiltros} registros={base} />

      <div
        className={`grid items-stretch gap-3 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-2 xl:grid-cols-4"}`}
      >
        <Kpi
          label="Solicitações Recebidas"
          value={counters?.recebida ?? 0}
          sub="Aguardando atribuição"
          icon={Inbox}
          iconBg="bg-emerald-50 text-emerald-700"
          filtro="recebida"
        />
        <Kpi
          label="Em Andamento"
          value={counters?.em_andamento ?? 0}
          sub="Em atendimento"
          icon={Clock}
          iconBg="bg-amber-50 text-amber-600"
          filtro="em_atendimento"
        />
        <Kpi
          label="Concluídas"
          value={counters?.concluida ?? 0}
          sub="Finalizadas"
          icon={CheckCircle2}
          iconBg="bg-green-50 text-green-600"
          filtro="concluida"
        />
        <Kpi
          label={isAdmin ? "Relatórios p/ validar" : "Meus relatórios"}
          value={counters?.relatorios_aguardando ?? 0}
          sub={isAdmin ? "Aguardando aprovação" : "Rascunho / correção"}
          icon={FileText}
          iconBg="bg-lime-50 text-lime-700"
          filtro="relatorios_validar"
        />
        {isAdmin && (
          <>
            <Kpi
              label="Escolas Ativas"
              value={counters?.total_escolas ?? 0}
              sub="Cadastradas"
              icon={School}
              iconBg="bg-teal-50 text-teal-700"
            />
            <Kpi
              label="Prof. Vivências"
              value={counters?.total_profissionais ?? 0}
              sub="Atendem o módulo"
              icon={Users}
              iconBg="bg-emerald-50 text-emerald-600"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="cpae-card border-0 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 160)" />
                <XAxis dataKey="mes" stroke="oklch(0.5 0.02 160)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 160)" fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="oklch(0.55 0.14 160)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                >
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
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-emerald-600" /> {pieTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados para exibir.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label={(e: { name?: string; value?: number; percent?: number }) =>
                      `${e.name}: ${e.value ?? 0} (${Math.round((e.percent ?? 0) * 100)}%)`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="cpae-card border-0 shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <School className="h-4 w-4 text-emerald-600" />
              {isAdmin ? "Solicitações por Região" : "Minhas solicitações por escolas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {barChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados para exibir.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 160)" />
                  <XAxis
                    dataKey="name"
                    stroke="oklch(0.5 0.02 160)"
                    fontSize={12}
                    interval={0}
                    angle={isAdmin ? 0 : -25}
                    textAnchor={isAdmin ? "middle" : "end"}
                    height={isAdmin ? 30 : 70}
                  />
                  <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 160)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.62 0.13 160)" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="rotulo"
                      position="top"
                      offset={6}
                      className="fill-[#0F172A] text-[11px] font-semibold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="cpae-card border-0 shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Vivências mais solicitadas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quantidade de turmas que pediram cada tema.
            </p>
          </CardHeader>
          <RankingBarChart data={byTema} unidade="Turmas" fill="oklch(0.6 0.13 160)" />
        </Card>

        {byPalestra.length > 0 && byPeriodo.length > 0 && (
          <Card className="cpae-card border-0 shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-600" /> Palestras solicitadas
              </CardTitle>
            </CardHeader>
            <RankingBarChart data={byPalestra} unidade="Palestras" fill="oklch(0.55 0.12 145)" />
          </Card>
        )}
      </div>
    </div>
  );
}

type RankingItem = { name: string; value: number; rotulo: string };

function rankingComPercentual(counts: Map<string, number>): RankingItem[] {
  const total = [...counts.values()].reduce((s, v) => s + v, 0);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      rotulo: `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
    }));
}

const RANKING_FONT_PX = 11;

function SingleLineTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="oklch(0.45 0.02 160)"
      fontSize={RANKING_FONT_PX}
      style={{ whiteSpace: "pre" }}
    >
      {payload?.value}
    </text>
  );
}

function RankingBarChart({ data, unidade, fill }: { data: RankingItem[]; unidade: string; fill: string }) {
  if (data.length === 0) {
    return (
      <CardContent className="h-72">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sem dados para exibir.
        </div>
      </CardContent>
    );
  }
  const longest = data.reduce((max, item) => Math.max(max, item.name.length), 0);
  const axisWidth = Math.ceil(longest * RANKING_FONT_PX * 0.56) + 16;
  return (
    <CardContent style={{ height: Math.max(288, data.length * 34 + 16) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
          <XAxis type="number" hide domain={[0, (max: number) => Math.max(max * 1.15, 1)]} />
          <YAxis
            type="category"
            dataKey="name"
            width={axisWidth}
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={<SingleLineTick />}
          />
          <Tooltip
            cursor={{ fill: "oklch(0.96 0.02 160)" }}
            formatter={(_value, _name, item) => [(item.payload as RankingItem).rotulo, unidade]}
          />
          <Bar dataKey="value" fill={fill} radius={[0, 6, 6, 0]} maxBarSize={22}>
            <LabelList dataKey="rotulo" position="right" className="fill-[#0F172A] text-[11px] font-semibold" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  );
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
  filtro?: VivenciasDemandasFiltro;
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
      to="/modulo-vivencias/demandas"
      search={{ filtro }}
      className="block h-full rounded-xl outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      title={`Ver demandas: ${label}`}
    >
      {card}
    </Link>
  );
}
