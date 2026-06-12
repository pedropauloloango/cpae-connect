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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { professionalStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/profissionais")({ component: Profissionais });

interface Pro { id: string; nome: string; matricula: string | null; cargo: string | null; especialidade: string | null; regiao_atuacao: string | null; email: string | null; telefone: string | null; status: string; }

function Profissionais() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").is("deleted_at", null).order("nome");
      if (error) throw error; return data as Pro[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, string>) => {
      const { error } = await supabase.from("professionals").insert({
        nome: vals.nome, matricula: vals.matricula || null, cpf: vals.cpf || null,
        email: vals.email || null, telefone: vals.telefone || null, cargo: vals.cargo || null,
        especialidade: vals.especialidade || null, regiao_atuacao: vals.regiao_atuacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profissional cadastrado"); qc.invalidateQueries({ queryKey: ["professionals"] }); setOpen(false); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("professionals").update({ status: status as "ativo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Equipe técnica da CPAE."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo profissional</Button></DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>Cadastrar profissional</DialogTitle></DialogHeader>
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
                  <div className="space-y-1.5"><Label>Matrícula</Label><Input name="matricula" /></div>
                  <div className="space-y-1.5"><Label>CPF</Label><Input name="cpf" /></div>
                  <div className="space-y-1.5"><Label>E-mail</Label><Input name="email" type="email" /></div>
                  <div className="space-y-1.5"><Label>Telefone</Label><Input name="telefone" /></div>
                  <div className="space-y-1.5"><Label>Cargo</Label><Input name="cargo" /></div>
                  <div className="space-y-1.5"><Label>Especialidade</Label><Input name="especialidade" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Região de atuação</Label><Input name="regiao_atuacao" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Matrícula</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Especialidade</th><th className="px-4 py-3">Região</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum profissional.</td></tr>)}
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.matricula ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.cargo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.especialidade ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.regiao_atuacao ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Select value={p.status} onValueChange={(v) => statusMut.mutate({ id: p.id, status: v })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(professionalStatusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {list.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{p.nome}</div>
                  <Badge variant="outline">{professionalStatusLabels[p.status]}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{p.cargo ?? "—"} • {p.regiao_atuacao ?? "—"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
