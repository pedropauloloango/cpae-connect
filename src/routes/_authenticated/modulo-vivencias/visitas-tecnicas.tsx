import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { SchoolSearchSelect, type PublicSchoolOption } from "@/components/schools/SchoolSearchSelect";
import { VisitStartTimeSelect } from "@/components/vivencias/VisitStartTimeSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
} from "@/components/ui/alert-dialog";
import { schoolTipoLabels } from "@/lib/labels";
import { normalizeRegiaoFromSchool, regiaoEscolaLabel } from "@/lib/acolhimento-options";
import { prepareAppointmentDatetimes } from "@/lib/appointment-utils";
import { buildVisitaTecnicaTitle, isVisitaTecnicaLocked } from "@/lib/visita-tecnica";
import { formatHoraInicio, parseHoraInicio, buildHoraInicio } from "@/lib/vivencia-schedule";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/visitas-tecnicas")({
  component: VisitasTecnicasPage,
});

type VisitaRow = {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  observacoes: string | null;
  professional_id: string | null;
  school_id: string | null;
  professional: { id: string; nome: string } | null;
  school: { id: string; nome: string; regiao: string | null; tipo_escola: string | null } | null;
};

type FormState = {
  schoolId: string | null;
  schoolNome: string;
  tipoEscola: string;
  regiao: string;
  professionalId: string;
  date: string;
  horaInicio: string;
  observacoes: string;
};

const emptyForm = (): FormState => ({
  schoolId: null,
  schoolNome: "",
  tipoEscola: "",
  regiao: "",
  professionalId: "",
  date: "",
  horaInicio: "",
  observacoes: "",
});

function toFormFromRow(row: VisitaRow): FormState {
  const d = new Date(row.inicio);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const { hour, minute } = parseHoraInicio(
    Number.isNaN(d.getTime()) ? null : `${pad(d.getHours())}:${pad(d.getMinutes())}:00`,
  );
  return {
    schoolId: row.school_id,
    schoolNome: row.school?.nome ?? "",
    tipoEscola: row.school?.tipo_escola ?? "",
    regiao: normalizeRegiaoFromSchool(row.school?.regiao),
    professionalId: row.professional_id ?? "",
    date,
    horaInicio: hour && minute ? buildHoraInicio(hour, minute) : "",
    observacoes: row.observacoes ?? "",
  };
}

function VisitasTecnicasPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VisitaRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VisitaRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: myProfId } = useQuery({
    queryKey: ["my-pro", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user,
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-vivencias-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome")
        .eq("status", "ativo")
        .eq("atende_vivencias", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: schools = [], isLoading: loadingSchools } = useQuery({
    queryKey: ["schools-ativas-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, nome, regiao, tipo_escola")
        .eq("status", "ativa")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as PublicSchoolOption[];
    },
  });

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["vivencias-visitas-tecnicas", isAdmin, myProfId],
    queryFn: async () => {
      if (!isAdmin && !myProfId) return [];
      let qb = supabase
        .from("appointments")
        .select(
          "id, titulo, inicio, fim, observacoes, professional_id, school_id, professional:professionals(id, nome), school:schools(id, nome, regiao, tipo_escola)",
        )
        .eq("modulo", "vivencias")
        .eq("tipo", "visita_tecnica")
        .order("inicio", { ascending: false });
      if (!isAdmin && myProfId) qb = qb.eq("professional_id", myProfId);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as VisitaRow[];
    },
    enabled: isAdmin || !!myProfId,
  });

  const upcoming = useMemo(
    () => visitas.filter((v) => !isVisitaTecnicaLocked(v.inicio)),
    [visitas],
  );
  const past = useMemo(
    () => visitas.filter((v) => isVisitaTecnicaLocked(v.inicio)),
    [visitas],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      professionalId: isAdmin ? "" : (myProfId ?? ""),
    });
    setDialogOpen(true);
  };

  const openEdit = (row: VisitaRow) => {
    if (isVisitaTecnicaLocked(row.inicio)) {
      toast.error("Esta visita já passou da data de realização e não pode ser editada.");
      return;
    }
    setEditing(row);
    setForm(toFormFromRow(row));
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.schoolId) throw new Error("Selecione a escola ou EMEI.");
      if (!form.date || !form.horaInicio) {
        throw new Error("Informe a data e o horário de início.");
      }
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      if (form.date < todayStr) {
        throw new Error("A data da visita não pode ser anterior a hoje.");
      }
      const professionalId = isAdmin ? form.professionalId : (myProfId ?? "");
      if (!professionalId) {
        throw new Error(
          isAdmin
            ? "Selecione o profissional responsável."
            : "Seu usuário não está vinculado a um profissional.",
        );
      }
      if (!form.tipoEscola) {
        throw new Error("A escola selecionada não possui tipo cadastrado.");
      }

      const { inicio, fim } = prepareAppointmentDatetimes({
        inicio: `${form.date}T${form.horaInicio}`,
      });

      if (editing && isVisitaTecnicaLocked(editing.inicio)) {
        throw new Error("Esta visita já passou da data de realização e não pode ser editada.");
      }

      const payload = {
        titulo: buildVisitaTecnicaTitle(form.schoolNome),
        tipo: "visita_tecnica" as const,
        modulo: "vivencias",
        school_id: form.schoolId,
        professional_id: professionalId,
        representante_nome: null,
        representante_cargo: null,
        inicio,
        fim,
        observacoes: form.observacoes.trim() || null,
        request_id: null,
        vivencia_request_id: null,
        created_by: user?.id ?? null,
      };

      if (editing) {
        const { data, error } = await supabase
          .from("appointments")
          .update({
            titulo: payload.titulo,
            school_id: payload.school_id,
            professional_id: payload.professional_id,
            representante_nome: null,
            representante_cargo: null,
            inicio: payload.inicio,
            fim: payload.fim,
            observacoes: payload.observacoes,
            tipo: payload.tipo,
            modulo: payload.modulo,
          })
          .eq("id", editing.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Não foi possível atualizar a visita.");
        return;
      }

      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Visita técnica atualizada." : "Visita técnica agendada.");
      qc.invalidateQueries({ queryKey: ["vivencias-visitas-tecnicas"] });
      qc.invalidateQueries({ queryKey: ["vivencias-appointments"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("modulo")
        ? "Banco desatualizado. Execute scripts/fix-appointments-modulo.sql no Supabase."
        : e.message;
      toast.error("Erro ao salvar", { description: msg });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (row: VisitaRow) => {
      if (isVisitaTecnicaLocked(row.inicio)) {
        throw new Error("Esta visita já passou da data de realização e não pode ser excluída.");
      }
      const { error } = await supabase.from("appointments").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita técnica excluída.");
      qc.invalidateQueries({ queryKey: ["vivencias-visitas-tecnicas"] });
      qc.invalidateQueries({ queryKey: ["vivencias-appointments"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Visita técnica"
        description="Agende visitas técnicas às escolas. Após a data de realização, o agendamento fica bloqueado para edição e exclusão."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova visita
          </Button>
        }
      />

      <div className="space-y-6">
        <VisitaList
          title="Agendadas"
          empty="Nenhuma visita técnica agendada."
          rows={upcoming}
          isLoading={isLoading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
        <VisitaList
          title="Realizadas / passadas"
          empty="Nenhuma visita técnica passada."
          rows={past}
          isLoading={false}
          locked
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar visita técnica" : "Nova visita técnica"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Escola / EMEI *</Label>
              <SchoolSearchSelect
                schools={schools}
                value={form.schoolId}
                loading={loadingSchools}
                onSelect={(s) =>
                  setForm((f) => ({
                    ...f,
                    schoolId: s.id,
                    schoolNome: s.nome,
                    tipoEscola: s.tipo_escola ?? "",
                    regiao: normalizeRegiaoFromSchool(s.regiao),
                  }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo Escola *</Label>
                <Input
                  readOnly
                  value={
                    form.tipoEscola
                      ? (schoolTipoLabels[form.tipoEscola] ?? form.tipoEscola)
                      : ""
                  }
                  placeholder="Preenchido ao selecionar a escola"
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Região onde a Escola / EMEI está localizada</Label>
                <Input
                  readOnly
                  value={form.regiao ? regiaoEscolaLabel(form.regiao) : ""}
                  placeholder="Preenchido ao selecionar a escola"
                  className="bg-muted/40"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Profissional *</Label>
                <Select
                  value={form.professionalId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data da visita *</Label>
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário de início *</Label>
                <p className="text-xs text-muted-foreground">Duração fixa de 1 hora.</p>
                <VisitStartTimeSelect
                  value={form.horaInicio}
                  onChange={(horaInicio) => setForm((f) => ({ ...f, horaInicio }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Combinados, contato, etc."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Agendar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita técnica?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o agendamento da agenda. Só é permitido até a data de realização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
              disabled={deleteMut.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VisitaList({
  title,
  empty,
  rows,
  isLoading,
  locked,
  onEdit,
  onDelete,
}: {
  title: string;
  empty: string;
  rows: VisitaRow[];
  isLoading: boolean;
  locked?: boolean;
  onEdit?: (row: VisitaRow) => void;
  onDelete?: (row: VisitaRow) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          {title}
          <Badge variant="secondary" className="ml-1">
            {rows.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const hora = formatHoraInicio(
                (() => {
                  const d = new Date(row.inicio);
                  if (Number.isNaN(d.getTime())) return null;
                  const pad = (n: number) => String(n).padStart(2, "0");
                  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
                })(),
              );
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium text-[#0F172A]">{row.titulo}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(row.inicio).toLocaleDateString("pt-BR")}
                      {hora !== "—" ? ` · ${hora} (1h)` : ""}
                      {row.professional?.nome ? ` · ${row.professional.nome}` : ""}
                    </div>
                    {(row.school?.tipo_escola || row.school?.regiao) && (
                      <div className="text-xs text-muted-foreground">
                        {row.school?.tipo_escola
                          ? (schoolTipoLabels[row.school.tipo_escola] ?? row.school.tipo_escola)
                          : null}
                        {row.school?.tipo_escola && row.school?.regiao ? " · " : null}
                        {row.school?.regiao
                          ? regiaoEscolaLabel(normalizeRegiaoFromSchool(row.school.regiao))
                          : null}
                      </div>
                    )}
                  </div>
                  {!locked && onEdit && onDelete && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                  {locked && (
                    <Badge variant="secondary" className="w-fit">
                      Bloqueada
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
