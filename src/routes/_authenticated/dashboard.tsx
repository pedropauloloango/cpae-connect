import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import {
  Inbox, Clock, CheckCircle2, Calendar, TrendingUp, AlertCircle, Users, School,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { complaintTypeLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

interface Counters { recebida: number; em_andamento: number; concluida: number; agendados_mes: number; total_escolas: number; total_profissionais: number; }

function Dashboard() {
  const { isAdmin, loading: authLoading } = useAuth();

  const { data: counters } = useQuery<Counters>({
    queryKey: ["dashboard-counters", isAdmin],
    enabled: !authLoading,
    queryFn: async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [r1, r2, r3, ap] = await Promise.all([
        supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "recebida"),
        supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", ["distribuida", "em_andamento", "aguardando_aprovacao"]),
        supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "concluida"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("inicio", monthStart.toISOString()),
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
        recebida: r1.count ?? 0, em_andamento: r2.count ?? 0, concluida: r3.count ?? 0,
        agendados_mes: ap.count ?? 0, total_escolas, total_profissionais,
      };
    },
  });

  const { data: byComplaint = [] } = useQuery({
    queryKey: ["dash-by-complaint"],
    queryFn: async () => {
      const { data } = await supabase.from("requests").select("tipo_queixa").is("deleted_at", null);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: { tipo_queixa: string }) => counts.set(r.tipo_queixa, (counts.get(r.tipo_queixa) ?? 0) + 1));
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
    queryKey: ["dash-by-school"],
    enabled: !authLoading && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("requests").select("school_nome_snapshot, school:schools(nome)").is("deleted_at", null);
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

  const { data: monthly = [] } = useQuery({
    queryKey: ["dash-monthly"],
    queryFn: async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
      const { data } = await supabase.from("requests").select("created_at").is("deleted_at", null).gte("created_at", since.toISOString());
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

      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        <Kpi label="Solicitações Recebidas" value={counters?.recebida ?? 0} icon={Inbox} tone="text-info" />
        <Kpi label="Em Andamento" value={counters?.em_andamento ?? 0} icon={Clock} tone="text-warning" />
        <Kpi label="Concluídas" value={counters?.concluida ?? 0} icon={CheckCircle2} tone="text-success" />
        <Kpi label="Atendimentos no Mês" value={counters?.agendados_mes ?? 0} icon={Calendar} tone="text-primary" />
        {isAdmin && (
          <>
            <Kpi label="Escolas Ativas" value={counters?.total_escolas ?? 0} icon={School} tone="text-accent" />
            <Kpi label="Profissionais Ativos" value={counters?.total_profissionais ?? 0} icon={Users} tone="text-primary" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Evolução Mensal</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 240)" />
                <XAxis dataKey="mes" stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="oklch(0.42 0.14 250)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Distribuição por Queixa</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byComplaint} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                  {byComplaint.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {!isAdmin && <School className="h-4 w-4" />}
              {isAdmin ? "Solicitações por Região" : "Minhas solicitações por escolas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
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
                <Bar dataKey="value" fill="oklch(0.62 0.13 200)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string; }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

