import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/escolas")({ component: Escolas });

interface School { id: string; nome: string; codigo_siger: string | null; codigo_inep: string | null; regiao: string | null; bairro: string | null; diretor_nome: string | null; status: string; }

function Escolas() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [regiao, setRegiao] = useState("todas");
  const [open, setOpen] = useState(false);

  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data as School[];
    },
  });

  const regioes = Array.from(new Set(schools.map((s) => s.regiao).filter(Boolean))) as string[];

  const filtered = schools.filter((s) => {
    if (regiao !== "todas" && s.regiao !== regiao) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return s.nome.toLowerCase().includes(t) || (s.codigo_siger ?? "").toLowerCase().includes(t) || (s.codigo_inep ?? "").toLowerCase().includes(t);
  });

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, string>) => {
      const { error } = await supabase.from("schools").insert({
        nome: vals.nome, codigo_siger: vals.codigo_siger || null, codigo_inep: vals.codigo_inep || null,
        endereco: vals.endereco || null, bairro: vals.bairro || null, cep: vals.cep || null,
        regiao: vals.regiao || null, email: vals.email || null, ramal: vals.ramal || null,
        tipologia: vals.tipologia || null, diretor_nome: vals.diretor_nome || null,
        diretor_celular: vals.diretor_celular || null, diretor_cpf: vals.diretor_cpf || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Escola cadastrada"); qc.invalidateQueries({ queryKey: ["schools"] }); setOpen(false); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Escolas"
        description="Cadastro das unidades escolares atendidas pela CPAE."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova escola</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>Cadastrar escola</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const obj: Record<string, string> = {};
                  f.forEach((v, k) => { obj[k] = String(v); });
                  createMut.mutate(obj);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Nome *</Label><Input name="nome" required /></div>
                  <div className="space-y-1.5"><Label>Código SIGER</Label><Input name="codigo_siger" /></div>
                  <div className="space-y-1.5"><Label>Código INEP/MEC</Label><Input name="codigo_inep" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label><Input name="endereco" /></div>
                  <div className="space-y-1.5"><Label>Bairro</Label><Input name="bairro" /></div>
                  <div className="space-y-1.5"><Label>CEP</Label><Input name="cep" /></div>
                  <div className="space-y-1.5"><Label>Região</Label><Input name="regiao" /></div>
                  <div className="space-y-1.5"><Label>Tipologia</Label><Input name="tipologia" /></div>
                  <div className="space-y-1.5"><Label>E-mail</Label><Input name="email" type="email" /></div>
                  <div className="space-y-1.5"><Label>Ramal</Label><Input name="ramal" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Diretor(a)</Label><Input name="diretor_nome" /></div>
                  <div className="space-y-1.5"><Label>Celular diretor(a)</Label><Input name="diretor_celular" /></div>
                  <div className="space-y-1.5"><Label>CPF/Matrícula</Label><Input name="diretor_cpf" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, SIGER ou INEP…" className="pl-9" />
          </div>
          <Select value={regiao} onValueChange={setRegiao}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as regiões</SelectItem>
              {regioes.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">SIGER</th><th className="px-4 py-3">INEP</th><th className="px-4 py-3">Região</th><th className="px-4 py-3">Diretor(a)</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma escola.</td></tr>)}
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{s.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.codigo_siger ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.codigo_inep ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.regiao ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.diretor_nome ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant={s.status === "ativa" ? "default" : "secondary"}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="p-4">
                <div className="font-medium">{s.nome}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.regiao ?? "—"} • {s.diretor_nome ?? "Diretor não informado"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
