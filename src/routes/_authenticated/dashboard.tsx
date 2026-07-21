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
import { cn } from "@/lib/utils";

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
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      let qRecebida = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "recebida");
      let qAndamento = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", ["distribuida", "em_andamento", "em_ajuste", "aguardando_aprovacao"]);
      let qConcluida = supabase.from("requests").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "concluida");
      let qAppt = supabase.from("appointments").select("id", { count: "exact", head: true }).gte("inicio", monthStart.toISOString()).is("vivencia_request_id", null);

      if (!isAdmin) {
        if (!myProfId) {
          return { recebida: 0, em_andamento: 0, concluida: 0, agendados_mes: 0, total_escolas: 0, total_profissionais: 0 };
        }
        qRecebida = qRecebida.eq("assigned_professional_id", myProfId);
        qAndamento = qAndamento.eq("assigned_professional_id", myProfId);
        qConcluida = qConcluida.eq("assigned_professional_id", myProfId);
        qAppt = qAppt.eq("professional_id", myProfId);
      }

      const [r1, r2, r3, ap] = await Promise.all([qRecebida, qAndamento, qConcluida, qAppt]);

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

      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        <Kpi label="Solicitações Recebidas" value={counters?.recebida ?? 0} sub="Total recebido" icon={Inbox} iconBg="bg-[#FAF5FF] text-[#7B2CBF]" />
        <Kpi label="Em Andamento" value={counters?.em_andamento ?? 0} sub="Em atendimento" icon={Clock} iconBg="bg-[#FFFBEB] text-[#F7B500]" />
        <Kpi label="Concluídas" value={counters?.concluida ?? 0} sub="Finalizadas" icon={CheckCircle2} iconBg="bg-[#F2FFF6] text-[#52C41A]" />
        <Kpi label="Atendimentos no Mês" value={counters?.agendados_mes ?? 0} sub="Agenda do mês" icon={Calendar} iconBg="bg-[#EAF2FF] text-[#0F52BA]" />
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

        <Card className="cpae-card border-0 shadow-none">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-[#0F52BA]" /> Distribuição por Queixa</CardTitle></CardHeader>
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

        <Card className="cpae-card border-0 shadow-none lg:col-span-2">
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

