import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { professionalStatusLabels } from "@/lib/labels";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/profissionais")({ component: Profissionais });

type ProfessionalStatus = Database["public"]["Enums"]["professional_status"];
type ModuleFilter = "todos" | "acolhimento" | "vivencias" | "ambos";
type StatusFilter = "todos" | ProfessionalStatus;

interface Pro {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  cargo: string | null;
  especialidade: string | null;
  regiao_atuacao: string | null;
  email: string | null;
  telefone: string | null;
  status: ProfessionalStatus;
  atende_acolhimento: boolean;
  atende_vivencias: boolean;
}

function formDataToRecord(form: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  form.forEach((v, k) => {
    obj[k] = String(v);
  });
  return obj;
}

function professionalFromForm(vals: Record<string, string>, status?: ProfessionalStatus) {
  return {
    nome: vals.nome.trim(),
    matricula: vals.matricula?.trim() || null,
    cpf: vals.cpf?.trim() || null,
    email: vals.email?.trim() || null,
    telefone: vals.telefone?.trim() || null,
    cargo: vals.cargo?.trim() || null,
    especialidade: vals.especialidade?.trim() || null,
    regiao_atuacao: vals.regiao_atuacao?.trim() || null,
    atende_acolhimento: vals.atende_acolhimento === "true",
    atende_vivencias: vals.atende_vivencias === "true",
    ...(status ? { status } : {}),
  };
}

function invalidateProfessionals(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["professionals"] });
  qc.invalidateQueries({ queryKey: ["professionals-active-acolhimento"] });
  qc.invalidateQueries({ queryKey: ["professionals-active-vivencias"] });
  qc.invalidateQueries({ queryKey: ["professionals-agenda-acolhimento"] });
  qc.invalidateQueries({ queryKey: ["config-professionals-unlinked"] });
}

function Profissionais() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<Pro | null>(null);
  const [editStatus, setEditStatus] = useState<ProfessionalStatus>("ativo");
  const [deleteTarget, setDeleteTarget] = useState<Pro | null>(null);
  const [filterNome, setFilterNome] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("todos");
  const [filterModulo, setFilterModulo] = useState<ModuleFilter>("todos");
  const [filterCargo, setFilterCargo] = useState<string>("todos");

  const { data: list = [] } = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data as Pro[];
    },
  });

  const cargos = useMemo(
    () =>
      Array.from(
        new Set(
          list
            .map((p) => p.cargo?.trim())
            .filter((c): c is string => Boolean(c)),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [list],
  );

  const filtered = useMemo(() => {
    const q = filterNome.trim().toLowerCase();
    return list.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q)) return false;
      if (filterStatus !== "todos" && p.status !== filterStatus) return false;
      if (filterCargo !== "todos" && (p.cargo?.trim() ?? "") !== filterCargo) return false;
      if (filterModulo === "acolhimento" && !p.atende_acolhimento) return false;
      if (filterModulo === "vivencias" && !p.atende_vivencias) return false;
      if (filterModulo === "ambos" && !(p.atende_acolhimento && p.atende_vivencias)) return false;
      return true;
    });
  }, [list, filterNome, filterStatus, filterModulo, filterCargo]);

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, string>) => {
      const { error } = await supabase.from("professionals").insert(professionalFromForm(vals));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional cadastrado");
      invalidateProfessionals(qc);
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, vals, status }: { id: string; vals: Record<string, string>; status: ProfessionalStatus }) => {
      const { error } = await supabase
        .from("professionals")
        .update(professionalFromForm(vals, status))
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional atualizado");
      invalidateProfessionals(qc);
      setEditingPro(null);
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("professionals")
        .update({ deleted_at: new Date().toISOString(), user_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional excluído");
      invalidateProfessionals(qc);
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const openEdit = (pro: Pro) => {
    setEditingPro(pro);
    setEditStatus(pro.status);
  };

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Equipe técnica da CPAE."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo profissional
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Cadastrar profissional</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createMut.mutate(formDataToRecord(new FormData(e.currentTarget)));
                }}
              >
                <ProfessionalFormFields />
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!editingPro} onOpenChange={(o) => !o && setEditingPro(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar profissional</DialogTitle>
          </DialogHeader>
          {editingPro && (
            <form
              key={editingPro.id}
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                updateMut.mutate({
                  id: editingPro.id,
                  vals: formDataToRecord(new FormData(e.currentTarget)),
                  status: editStatus,
                });
              }}
            >
              <ProfessionalFormFields
                defaults={{
                  nome: editingPro.nome,
                  matricula: editingPro.matricula ?? "",
                  cpf: editingPro.cpf ?? "",
                  email: editingPro.email ?? "",
                  telefone: editingPro.telefone ?? "",
                  cargo: editingPro.cargo ?? "",
                  especialidade: editingPro.especialidade ?? "",
                  regiao_atuacao: editingPro.regiao_atuacao ?? "",
                }}
                moduleDefaults={{
                  acolhimento: editingPro.atende_acolhimento,
                  vivencias: editingPro.atende_vivencias,
                }}
                status={editStatus}
                onStatusChange={setEditStatus}
              />
              <Button type="submit" className="w-full" disabled={updateMut.isPending}>
                {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional <strong>{deleteTarget?.nome}</strong> será removido da listagem. O vínculo com usuário do
              sistema, se existir, será desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterNome}
              onChange={(e) => setFilterNome(e.target.value)}
              placeholder="Filtrar por nome…"
              className="pl-9"
              aria-label="Filtrar por nome"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(professionalStatusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterModulo} onValueChange={(v) => setFilterModulo(v as ModuleFilter)}>
            <SelectTrigger aria-label="Filtrar por módulo">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os módulos</SelectItem>
              <SelectItem value="acolhimento">Acolhimento</SelectItem>
              <SelectItem value="vivencias">Vivências</SelectItem>
              <SelectItem value="ambos">Acolhimento e Vivências</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCargo} onValueChange={setFilterCargo}>
            <SelectTrigger aria-label="Filtrar por cargo">
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cargos</SelectItem>
              {cargos.map((cargo) => (
                <SelectItem key={cargo} value={cargo}>
                  {cargo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Especialidade</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3">Módulos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {list.length === 0 ? "Nenhum profissional." : "Nenhum profissional com estes filtros."}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.matricula ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.cargo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.especialidade ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.regiao_atuacao ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.atende_acolhimento && <Badge variant="secondary">Acolhimento</Badge>}
                        {p.atende_vivencias && <Badge variant="secondary">Vivências</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{professionalStatusLabels[p.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Editar profissional"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Excluir profissional"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {list.length === 0 ? "Nenhum profissional." : "Nenhum profissional com estes filtros."}
              </div>
            )}
            {filtered.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{p.nome}</div>
                      <Badge variant="outline">{professionalStatusLabels[p.status]}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.cargo ?? "—"} • {p.regiao_atuacao ?? "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.atende_acolhimento && <Badge variant="secondary">Acolhimento</Badge>}
                      {p.atende_vivencias && <Badge variant="secondary">Vivências</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar profissional"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Excluir profissional"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfessionalFormFields({
  defaults = {},
  moduleDefaults = { acolhimento: true, vivencias: true },
  status,
  onStatusChange,
}: {
  defaults?: Partial<Record<string, string>>;
  moduleDefaults?: { acolhimento: boolean; vivencias: boolean };
  status?: ProfessionalStatus;
  onStatusChange?: (status: ProfessionalStatus) => void;
}) {
  const [acolhimento, setAcolhimento] = useState(moduleDefaults.acolhimento);
  const [vivencias, setVivencias] = useState(moduleDefaults.vivencias);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Nome *</Label>
        <Input name="nome" required defaultValue={defaults.nome} />
      </div>
      <div className="space-y-1.5">
        <Label>Matrícula</Label>
        <Input name="matricula" defaultValue={defaults.matricula} />
      </div>
      <div className="space-y-1.5">
        <Label>CPF</Label>
        <Input name="cpf" defaultValue={defaults.cpf} />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input name="email" type="email" defaultValue={defaults.email} />
      </div>
      <div className="space-y-1.5">
        <Label>Telefone</Label>
        <Input name="telefone" defaultValue={defaults.telefone} />
      </div>
      <div className="space-y-1.5">
        <Label>Cargo</Label>
        <Input name="cargo" defaultValue={defaults.cargo} />
      </div>
      <div className="space-y-1.5">
        <Label>Especialidade</Label>
        <Input name="especialidade" defaultValue={defaults.especialidade} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Região de atuação</Label>
        <Input name="regiao_atuacao" defaultValue={defaults.regiao_atuacao} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Módulos de atuação *</Label>
        <p className="text-xs text-muted-foreground">Selecione pelo menos um módulo.</p>
        <input type="hidden" name="atende_acolhimento" value={String(acolhimento)} />
        <input type="hidden" name="atende_vivencias" value={String(vivencias)} />
        <div className="flex flex-wrap gap-5 rounded-md border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={acolhimento}
              disabled={acolhimento && !vivencias}
              onCheckedChange={(checked) => setAcolhimento(checked === true)}
            />
            Acolhimento
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={vivencias}
              disabled={vivencias && !acolhimento}
              onCheckedChange={(checked) => setVivencias(checked === true)}
            />
            Vivências
          </label>
        </div>
      </div>
      {status !== undefined && onStatusChange && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Status *</Label>
          <Select value={status} onValueChange={(v) => onStatusChange(v as ProfessionalStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(professionalStatusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
