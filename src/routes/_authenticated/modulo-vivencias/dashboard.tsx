import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { periodoLabels, regiaoEscolaLabel } from "@/lib/acolhimento-options";
import { palestraTemaLabel, vivenciaTemaLabel } from "@/lib/vivencias-options";
import type { VivenciasDemandasFiltro } from "@/lib/vivencias-demandas-filtros";
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
  const professionalScopeEmpty = !isAdmin && myProfId && myRequestIds.length === 0;

  const { data: counters } = useQuery<Counters>({
    queryKey: ["viv-dashboard-counters", isAdmin, myProfId, myRequestIds],
    enabled: !authLoading && scopeReady && (isAdmin || myProfId !== null),
    queryFn: async () => {
      const empty: Counters = {
        recebida: 0,
        em_andamento: 0,
        concluida: 0,
        relatorios_aguardando: 0,
        total_escolas: 0,
        total_profissionais: 0,
      };

      if (!isAdmin && (!myProfId || professionalScopeEmpty)) return empty;

      let qRecebida = supabase
        .from("vivencia_requests")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "recebida");
      let qAndamento = supabase
        .from("vivencia_requests")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["distribuida", "em_andamento", "em_ajuste", "aguardando_aprovacao"]);
      let qConcluida = supabase
        .from("vivencia_requests")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "concluida");

      if (!isAdmin) {
        qRecebida = qRecebida.in("id", myRequestIds);
        qAndamento = qAndamento.in("id", myRequestIds);
        qConcluida = qConcluida.in("id", myRequestIds);
      }

      const [r1, r2, r3] = await Promise.all([qRecebida, qAndamento, qConcluida]);

      let relatorios_aguardando = 0;
      if (isAdmin) {
        const { count } = await supabase
          .from("vivencia_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "aguardando_aprovacao");
        relatorios_aguardando = count ?? 0;
      } else {
        const { count } = await supabase
          .from("vivencia_reports")
          .select("id", { count: "exact", head: true })
          .in("vivencia_request_id", myRequestIds)
          .in("status", ["correcao_solicitada", "rejeitado", "rascunho"]);
        relatorios_aguardando = count ?? 0;
      }

      let total_escolas = 0;
      let total_profissionais = 0;
      if (isAdmin) {
        const [sc, pr] = await Promise.all([
          supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null),
          supabase
            .from("professionals")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", "ativo")
            .eq("atende_vivencias", true),
        ]);
        total_escolas = sc.count ?? 0;
        total_profissionais = pr.count ?? 0;
      }

      return {
        recebida: r1.count ?? 0,
        em_andamento: r2.count ?? 0,
        concluida: r3.count ?? 0,
        relatorios_aguardando,
        total_escolas,
        total_profissionais,
      };
    },
  });

  const { data: byPeriodo = [] } = useQuery({
    queryKey: ["viv-dash-by-periodo", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];

      let activeQ = supabase
        .from("vivencia_requests")
        .select("id")
        .is("deleted_at", null);
      if (!isAdmin) activeQ = activeQ.in("id", myRequestIds);
      const { data: activeReqs, error: activeError } = await activeQ;
      if (activeError) throw activeError;
      const activeIds = (activeReqs ?? []).map((r) => r.id);
      if (activeIds.length === 0) return [];

      const { data, error } = await supabase
        .from("vivencia_request_groups")
        .select("periodo")
        .in("vivencia_request_id", activeIds);
      if (error) throw error;

      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { periodo: string | null }) => {
        if (!r.periodo?.trim()) return;
        counts.set(r.periodo, (counts.get(r.periodo) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([k, v]) => ({
        name: periodoLabels[k] ?? k,
        value: v,
      }));
    },
  });

  const { data: byTema = [] } = useQuery({
    queryKey: ["viv-dash-by-tema", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];
      const counts = new Map<string, number>();
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        let q = supabase
          .from("vivencia_request_groups")
          .select("id, temas, req:vivencia_requests!inner(deleted_at)")
          .is("req.deleted_at", null)
          .order("id")
          .range(from, from + PAGE - 1);
        if (!isAdmin) q = q.in("vivencia_request_id", myRequestIds);
        const { data, error } = await q;
        if (error) throw error;
        const chunk = (data ?? []) as { temas: string[] | null }[];
        chunk.forEach((g) => {
          new Set(g.temas ?? []).forEach((t) => {
            if (!t?.trim()) return;
            counts.set(t, (counts.get(t) ?? 0) + 1);
          });
        });
        if (chunk.length < PAGE) break;
      }
      const total = [...counts.values()].reduce((s, v) => s + v, 0);
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({
          name: vivenciaTemaLabel(k),
          value: v,
          rotulo: `${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
        }));
    },
  });

  const { data: byPalestra = [] } = useQuery({
    queryKey: ["viv-dash-by-palestra", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];
      const counts = new Map<string, number>();

      let legacyQ = supabase
        .from("vivencia_requests")
        .select("id, palestra_tema")
        .is("deleted_at", null)
        .not("palestra_tema", "is", null);
      if (!isAdmin) legacyQ = legacyQ.in("id", myRequestIds);
      const { data: legacy } = await legacyQ;
      (legacy ?? []).forEach((r: { palestra_tema: string | null }) => {
        if (!r.palestra_tema) return;
        counts.set(r.palestra_tema, (counts.get(r.palestra_tema) ?? 0) + 1);
      });

      let multiQ = supabase
        .from("vivencia_request_palestras")
        .select("palestra_tema, vivencia_request_id");
      if (!isAdmin) multiQ = multiQ.in("vivencia_request_id", myRequestIds);
      const { data: multi } = await multiQ;
      (multi ?? []).forEach((r: { palestra_tema: string | null }) => {
        if (!r.palestra_tema) return;
        counts.set(r.palestra_tema, (counts.get(r.palestra_tema) ?? 0) + 1);
      });

      const total = [...counts.values()].reduce((s, v) => s + v, 0);
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({
          name: palestraTemaLabel(k),
          value: v,
          rotulo: `${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
        }));
    },
  });

  const { data: byRegion = [] } = useQuery({
    queryKey: ["viv-dash-by-region"],
    enabled: !authLoading && isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("vivencia_requests")
        .select("regiao_escola, school:schools(regiao)")
        .is("deleted_at", null);
      const counts = new Map<string, number>();
      (data ?? []).forEach(
        (r: { regiao_escola: string | null; school: { regiao: string | null } | null }) => {
          const raw = r.regiao_escola ?? r.school?.regiao ?? "Sem região";
          const key = regiaoEscolaLabel(raw) || raw;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        },
      );
      return rankingComPercentual(counts).slice(0, 8);
    },
  });

  const { data: bySchool = [] } = useQuery({
    queryKey: ["viv-dash-by-school", myRequestIds],
    enabled: !authLoading && !isAdmin && myProfId !== undefined,
    queryFn: async () => {
      if (myRequestIds.length === 0) return [];
      const { data } = await supabase
        .from("vivencia_requests")
        .select("school_nome_snapshot, school:schools(nome)")
        .is("deleted_at", null)
        .in("id", myRequestIds);
      const counts = new Map<string, number>();
      (data ?? []).forEach(
        (r: { school_nome_snapshot: string | null; school: { nome: string } | null }) => {
          const key = r.school?.nome ?? r.school_nome_snapshot ?? "Sem escola";
          counts.set(key, (counts.get(key) ?? 0) + 1);
        },
      );
      return rankingComPercentual(counts).slice(0, 10);
    },
  });

  const barChartData = isAdmin ? byRegion : bySchool;

  const { data: monthly = [] } = useQuery({
    queryKey: ["viv-dash-monthly", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      let qb = supabase
        .from("vivencia_requests")
        .select("created_at")
        .is("deleted_at", null)
        .gte("created_at", since.toISOString());
      if (!isAdmin) qb = qb.in("id", myRequestIds);
      const { data } = await qb;
      const buckets = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
      }
      (data ?? []).forEach((r: { created_at: string }) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return Array.from(buckets.entries()).map(([k, v]) => ({
        mes: monthNames[Number(k.split("-")[1]) - 1],
        total: v,
      }));
    },
  });

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
