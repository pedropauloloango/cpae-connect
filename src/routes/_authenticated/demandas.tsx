import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/AppShell";
import { complaintTypeLabels, requestStatusLabels, requestStatusTone } from "@/lib/labels";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas")({ component: Demandas });

interface Req {
  id: string; numero: string; aluno_nome: string; tipo_queixa: string; status: string;
  created_at: string; school_nome_snapshot: string | null;
  school: { regiao: string | null } | null;
  professional: { nome: string } | null;
}

function Demandas() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("todos");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["demandas", status],
    queryFn: async () => {
      let qb = supabase
        .from("requests")
        .select("id, numero, aluno_nome, tipo_queixa, status, created_at, school_nome_snapshot, school:schools(regiao), professional:professionals!assigned_professional_id(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "todos") qb = qb.eq("status", status as "recebida");
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as Req[];
    },
  });

  const filtered = list.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.numero.toLowerCase().includes(s) ||
      r.aluno_nome.toLowerCase().includes(s) ||
      (r.school_nome_snapshot ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader title="Demandas" description="Acompanhamento das solicitações de acolhimento." />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, aluno ou escola…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(requestStatusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Escola</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3">Queixa</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recebida</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && (<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>)}
                {!isLoading && filtered.length === 0 && (<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma demanda encontrada.</td></tr>)}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/demandas/$id" params={{ id: r.id }} className="font-mono text-xs font-medium text-primary hover:underline">{r.numero}</Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.aluno_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school_nome_snapshot ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.school?.regiao ?? "—"}</td>
                    <td className="px-4 py-3">{complaintTypeLabels[r.tipo_queixa]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.professional?.nome ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={requestStatusTone[r.status]}>{requestStatusLabels[r.status]}</Badge></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y md:hidden">
            {isLoading && <div className="p-6 text-center text-muted-foreground">Carregando…</div>}
            {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhuma demanda.</div>}
            {filtered.map((r) => (
              <Link key={r.id} to="/demandas/$id" params={{ id: r.id }} className="block p-4 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{r.numero}</span>
                  <Badge variant="outline" className={requestStatusTone[r.status]}>{requestStatusLabels[r.status]}</Badge>
                </div>
                <div className="mt-1 font-medium">{r.aluno_nome}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{r.school_nome_snapshot ?? "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{complaintTypeLabels[r.tipo_queixa]} • {new Date(r.created_at).toLocaleDateString("pt-BR")}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
