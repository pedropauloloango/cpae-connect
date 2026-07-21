import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Inbox,
  Clock,
  CheckCircle2,
  Calendar,
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
} from "recharts";
import { periodoLabels, regiaoEscolaLabel } from "@/lib/acolhimento-options";
import { palestraTemaLabel } from "@/lib/vivencias-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/dashboard")({
  component: VivenciasDashboard,
});

interface Counters {
  recebida: number;
  em_andamento: number;
  concluida: number;
  preferencias_mes: number;
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
        preferencias_mes: 0,
        relatorios_aguardando: 0,
        total_escolas: 0,
        total_profissionais: 0,
      };

      if (!isAdmin && (!myProfId || professionalScopeEmpty)) return empty;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString().slice(0, 10);

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

      let preferencias_mes = 0;
      let qGroups = supabase
        .from("vivencia_request_groups")
        .select("id, vivencia_request_id")
        .gte("data_preferivel", monthStartIso);
      if (!isAdmin) qGroups = qGroups.in("vivencia_request_id", myRequestIds);
      const { data: groupsMonth } = await qGroups;
      preferencias_mes = groupsMonth?.length ?? 0;

      let qPalestra = supabase
        .from("vivencia_requests")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("data_preferivel_palestra", monthStartIso);
      if (!isAdmin) qPalestra = qPalestra.in("id", myRequestIds);
      const { count: palestraCount } = await qPalestra;
      preferencias_mes += palestraCount ?? 0;

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
        preferencias_mes,
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
      let qb = supabase.from("vivencia_request_groups").select("periodo, vivencia_request_id");
      if (!isAdmin) qb = qb.in("vivencia_request_id", myRequestIds);
      const { data } = await qb;
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { periodo: string }) => {
        counts.set(r.periodo, (counts.get(r.periodo) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([k, v]) => ({
        name: periodoLabels[k] ?? k,
        value: v,
      }));
    },
  });

  const { data: byPalestra = [] } = useQuery({
    queryKey: ["viv-dash-by-palestra", isAdmin, myRequestIds],
    enabled: !authLoading && scopeReady,
    queryFn: async () => {
      if (!isAdmin && myRequestIds.length === 0) return [];
      let qb = supabase
        .from("vivencia_requests")
        .select("palestra_tema")
        .is("deleted_at", null)
        .not("palestra_tema", "is", null);
      if (!isAdmin) qb = qb.in("id", myRequestIds);
      const { data } = await qb;
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { palestra_tema: string | null }) => {
        if (!r.palestra_tema) return;
        counts.set(r.palestra_tema, (counts.get(r.palestra_tema) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([k, v]) => ({
        name: palestraTemaLabel(k),
        value: v,
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
      return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
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
      return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
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
        className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4 xl:grid-cols-7" : "lg:grid-cols-3 xl:grid-cols-5"}`}
      >
        <Kpi
          label="Solicitações Recebidas"
          value={counters?.recebida ?? 0}
          sub="Aguardando atribuição"
          icon={Inbox}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <Kpi
          label="Em Andamento"
          value={counters?.em_andamento ?? 0}
          sub="Em atendimento"
          icon={Clock}
          iconBg="bg-amber-50 text-amber-600"
        />
        <Kpi
          label="Concluídas"
          value={counters?.concluida ?? 0}
          sub="Finalizadas"
          icon={CheckCircle2}
          iconBg="bg-green-50 text-green-600"
        />
        <Kpi
          label="Datas no Mês"
          value={counters?.preferencias_mes ?? 0}
          sub="Preferências do mês"
          icon={Calendar}
          iconBg="bg-teal-50 text-teal-700"
        />
        <Kpi
          label={isAdmin ? "Relatórios p/ validar" : "Meus relatórios"}
          value={counters?.relatorios_aguardando ?? 0}
          sub={isAdmin ? "Aguardando aprovação" : "Rascunho / correção"}
          icon={FileText}
          iconBg="bg-lime-50 text-lime-700"
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
              <LineChart data={monthly}>
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
                />
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
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
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
                <BarChart data={barChartData}>
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
                  <Bar dataKey="value" fill="oklch(0.62 0.13 160)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {byPalestra.length > 0 && byPeriodo.length > 0 && (
          <Card className="cpae-card border-0 shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-600" /> Palestras solicitadas
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPalestra} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 160)" />
                  <XAxis type="number" allowDecimals={false} stroke="oklch(0.5 0.02 160)" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={180}
                    stroke="oklch(0.5 0.02 160)"
                    fontSize={11}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.55 0.12 145)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}) {
  return (
    <Card className="cpae-card border-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#64748B]">{label}</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-[#0F172A]">{value}</div>
            <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
