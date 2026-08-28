import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SchoolSearchSelect } from "@/components/schools/SchoolSearchSelect";
import { loadPublicSchools } from "@/lib/public-schools";
import {
  formatCpfMask,
  nivelEscolaridadeLabels,
  nivelEscolaridadeOptions,
} from "@/lib/saude-mental-options";
import { ArrowLeft, Loader2, Pencil, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/inscritos/$id")({
  component: SaudeMentalInscritoDetail,
});

type Inscrito = {
  id: string;
  numero: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  email: string | null;
  email_formulario: string | null;
  telefone_whatsapp: string | null;
  funcao: string | null;
  nivel_escolaridade: string | null;
  ano_curso: number;
  escola_texto: string | null;
  school_nome_snapshot: string | null;
  school_id: string | null;
  inscrito_em: string | null;
  created_at: string;
  origem: string;
  status: string;
};

type EditForm = {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  email: string;
  email_formulario: string;
  telefone_whatsapp: string;
  funcao: string;
  nivel_escolaridade: string;
  ano_curso: string;
  status: string;
};

function formatDateBr(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function toEditForm(row: Inscrito): EditForm {
  return {
    nome_completo: row.nome_completo ?? "",
    cpf: row.cpf ? formatCpfMask(row.cpf) : "",
    data_nascimento: row.data_nascimento ?? "",
    email: row.email ?? "",
    email_formulario: row.email_formulario ?? "",
    telefone_whatsapp: row.telefone_whatsapp ?? "",
    funcao: row.funcao ?? "",
    nivel_escolaridade: row.nivel_escolaridade ?? "",
    ano_curso: String(row.ano_curso ?? new Date().getFullYear()),
    status: row.status ?? "inscrito",
  };
}

function SaudeMentalInscritoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pendingSchoolId, setPendingSchoolId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const { data: row, isLoading } = useQuery({
    queryKey: ["saude-mental-inscrito", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_inscritos")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as Inscrito | null;
    },
  });

  const schoolsQuery = useQuery({
    queryKey: ["public-schools"],
    queryFn: loadPublicSchools,
  });

  const linkMut = useMutation({
    mutationFn: async (school: { id: string; nome: string } | null) => {
      const { error } = await supabase
        .from("saude_mental_inscritos")
        .update({
          school_id: school?.id ?? null,
          school_nome_snapshot: school?.nome ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo com escola atualizado");
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscrito", id] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscritos"] });
      setPendingSchoolId(null);
    },
    onError: (e: Error) => toast.error("Erro ao vincular", { description: e.message }),
  });

  const editMut = useMutation({
    mutationFn: async (form: EditForm) => {
      const nome = form.nome_completo.trim();
      if (nome.length < 3) throw new Error("Informe o nome completo.");
      const ano = Number(form.ano_curso);
      if (!Number.isFinite(ano) || ano < 2000) throw new Error("Informe um ano do curso válido.");

      const { error } = await supabase
        .from("saude_mental_inscritos")
        .update({
          nome_completo: nome.toUpperCase(),
          cpf: form.cpf.replace(/\D/g, "") || null,
          data_nascimento: form.data_nascimento || null,
          email: form.email.trim().toLowerCase() || null,
          email_formulario: form.email_formulario.trim().toLowerCase() || null,
          telefone_whatsapp: form.telefone_whatsapp.trim() || null,
          funcao: form.funcao.trim() || null,
          nivel_escolaridade: form.nivel_escolaridade || null,
          ano_curso: ano,
          status: form.status || "inscrito",
        })
        .eq("id", id)
        .is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados pessoais atualizados");
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscrito", id] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscritos"] });
      setEditOpen(false);
      setEditForm(null);
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("excluir_saude_mental_inscrito", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição excluída");
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscritos"] });
      void qc.removeQueries({ queryKey: ["saude-mental-inscrito", id] });
      void navigate({ to: "/modulo-saude-mental/inscritos" });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Inscrito não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/modulo-saude-mental/inscritos">Voltar</Link>
        </Button>
      </div>
    );
  }

  const selectedId = pendingSchoolId ?? row.school_id;

  const openEdit = () => {
    setEditForm(toEditForm(row));
    setEditOpen(true);
  };

  return (
    <div>
      <Link
        to="/modulo-saude-mental/inscritos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <PageHeader title={row.nome_completo} description={`Inscrição ${row.numero}`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="cpae-card border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Dados pessoais</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="CPF" value={row.cpf} />
            <Row label="Nascimento" value={formatDateBr(row.data_nascimento)} />
            <Row label="E-mail" value={row.email} />
            <Row label="E-mail do formulário" value={row.email_formulario} />
            <Row label="WhatsApp" value={row.telefone_whatsapp} />
            <Row label="Função" value={row.funcao} />
            <Row label="Ano do curso" value={String(row.ano_curso)} />
            <Row
              label="Escolaridade"
              value={
                nivelEscolaridadeLabels[row.nivel_escolaridade ?? ""] ?? row.nivel_escolaridade
              }
            />
            <Row
              label="Inscrito em"
              value={
                row.inscrito_em
                  ? new Date(row.inscrito_em).toLocaleString("pt-BR")
                  : new Date(row.created_at).toLocaleString("pt-BR")
              }
            />
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary">{row.origem}</Badge>
              <Badge variant="outline">{row.status}</Badge>
            </div>

            <div className="border-t pt-4">
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir inscrição
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir inscrição?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A inscrição de <strong>{row.nome_completo}</strong> ({row.numero}) será
                      removida da listagem. Esta ação não pode ser desfeita facilmente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteMut.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        deleteMut.mutate();
                      }}
                    >
                      {deleteMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card className="cpae-card border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Escola / EMEI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {row.escola_texto && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Texto informado na inscrição
                </p>
                <p className="mt-1">{row.escola_texto}</p>
              </div>
            )}

            {row.school_id ? (
              <div className="rounded-lg border bg-emerald-50/60 px-3 py-2 text-emerald-900">
                Vinculada: <strong>{row.school_nome_snapshot}</strong>
              </div>
            ) : (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                Sem vínculo — selecione a escola abaixo
              </Badge>
            )}

            <div className="space-y-2">
              <Label>Vincular escola cadastrada</Label>
              <SchoolSearchSelect
                schools={schoolsQuery.data ?? []}
                value={selectedId}
                onSelect={(school) => setPendingSchoolId(school.id)}
                loading={schoolsQuery.isLoading}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  linkMut.isPending ||
                  !pendingSchoolId ||
                  pendingSchoolId === row.school_id
                }
                onClick={() => {
                  const school = (schoolsQuery.data ?? []).find((s) => s.id === pendingSchoolId);
                  if (!school) return;
                  linkMut.mutate(school);
                }}
              >
                {linkMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar vínculo
              </Button>
              {row.school_id && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={linkMut.isPending}
                  onClick={() => linkMut.mutate(null)}
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  Remover vínculo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar dados pessoais</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-3 py-1">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input
                  value={editForm.nome_completo}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, nome_completo: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input
                    inputMode="numeric"
                    value={editForm.cpf}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, cpf: formatCpfMask(e.target.value) } : f,
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nascimento</Label>
                  <Input
                    type="date"
                    value={editForm.data_nascimento}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, data_nascimento: e.target.value } : f))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, email: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail do formulário</Label>
                <Input
                  type="email"
                  value={editForm.email_formulario}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, email_formulario: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <Input
                  value={editForm.telefone_whatsapp}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, telefone_whatsapp: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <Input
                  value={editForm.funcao}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, funcao: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ano do curso</Label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={editForm.ano_curso}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, ano_curso: e.target.value } : f))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) =>
                      setEditForm((f) => (f ? { ...f, status: v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inscrito">inscrito</SelectItem>
                      <SelectItem value="cancelado">cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Escolaridade</Label>
                <Select
                  value={editForm.nivel_escolaridade || undefined}
                  onValueChange={(v) =>
                    setEditForm((f) => (f ? { ...f, nivel_escolaridade: v } : f))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {nivelEscolaridadeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                    {editForm.nivel_escolaridade &&
                      !nivelEscolaridadeOptions.some(
                        (o) => o.value === editForm.nivel_escolaridade,
                      ) && (
                        <SelectItem value={editForm.nivel_escolaridade}>
                          {editForm.nivel_escolaridade}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={editMut.isPending || !editForm}
              onClick={() => editForm && editMut.mutate(editForm)}
            >
              {editMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
