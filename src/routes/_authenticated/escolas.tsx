import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Download, Upload, Loader2, AlertCircle, CheckCircle2, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { schoolTipoLabels } from "@/lib/labels";
import {
  downloadSchoolImportTemplate,
  formValuesToSchoolRow,
  parseSchoolImportFile,
  type SchoolImportPreview,
  type SchoolImportRow,
} from "@/lib/schools-import";

export const Route = createFileRoute("/_authenticated/escolas")({ component: Escolas });

const PAGE_SIZE = 15;

interface School {
  id: string;
  nome: string;
  tipo_escola?: "escola" | "emei" | null;
  codigo_siger: string | null;
  codigo_inep: string | null;
  regiao: string | null;
  bairro: string | null;
  endereco: string | null;
  cep: string | null;
  tipologia: string | null;
  email: string | null;
  ramal: string | null;
  diretor_nome: string | null;
  diretor_celular: string | null;
  diretor_cpf: string | null;
  status: string;
}

function formDataToRecord(form: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  form.forEach((v, k) => {
    obj[k] = String(v);
  });
  return obj;
}

async function insertSchools(rows: SchoolImportRow[]) {
  const { error } = await supabase.from("schools").insert(rows);
  if (error) throw error;
}

function Escolas() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [regiao, setRegiao] = useState("todas");
  const [filterTipo, setFilterTipo] = useState<"todos" | "escola" | "emei">("todos");
  const [open, setOpen] = useState(false);
  const [tipoEscola, setTipoEscola] = useState<"escola" | "emei">("escola");
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editTipoEscola, setEditTipoEscola] = useState<"escola" | "emei">("escola");
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [importPreview, setImportPreview] = useState<SchoolImportPreview | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [page, setPage] = useState(1);

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
    if (filterTipo !== "todos" && (s.tipo_escola ?? "escola") !== filterTipo) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      s.nome.toLowerCase().includes(t) ||
      (s.codigo_siger ?? "").toLowerCase().includes(t) ||
      (s.codigo_inep ?? "").toLowerCase().includes(t)
    );
  });

  useEffect(() => {
    setPage(1);
  }, [q, regiao, filterTipo]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = totalFiltered === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + PAGE_SIZE, totalFiltered);

  const onDialogOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setImportPreview(null);
      setTipoEscola("escola");
    }
  };

  const createMut = useMutation({
    mutationFn: async (vals: Record<string, string>) => insertSchools([formValuesToSchoolRow(vals)]),
    onSuccess: () => {
      toast.success("Escola cadastrada");
      qc.invalidateQueries({ queryKey: ["schools"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const bulkMut = useMutation({
    mutationFn: insertSchools,
    onSuccess: (_, rows) => {
      toast.success(`${rows.length} escola(s) cadastrada(s) com sucesso.`);
      qc.invalidateQueries({ queryKey: ["schools"] });
      setImportPreview(null);
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erro ao importar", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, vals }: { id: string; vals: Record<string, string> }) => {
      const { error } = await supabase.from("schools").update(formValuesToSchoolRow(vals)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escola atualizada");
      qc.invalidateQueries({ queryKey: ["schools"] });
      setEditingSchool(null);
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schools")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escola excluída");
      qc.invalidateQueries({ queryKey: ["schools"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const openEdit = (school: School) => {
    setEditingSchool(school);
    setEditTipoEscola(school.tipo_escola ?? "escola");
  };

  const handleFileSelect = async (file: File) => {
    setParsingFile(true);
    try {
      const preview = await parseSchoolImportFile(file);
      setImportPreview(preview);
      if (preview.valid.length === 0) {
        toast.error("Nenhuma escola válida encontrada na planilha.");
      }
    } catch {
      toast.error("Não foi possível ler o arquivo.");
      setImportPreview(null);
    } finally {
      setParsingFile(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Escolas"
        description="Cadastro das unidades escolares atendidas pela CPAE."
        actions={
          <Dialog open={open} onOpenChange={onDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova escola
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar escola</DialogTitle>
              </DialogHeader>

              <SchoolImportSection
                fileInputRef={fileInputRef}
                importPreview={importPreview}
                parsingFile={parsingFile}
                confirming={bulkMut.isPending}
                onDownloadTemplate={downloadSchoolImportTemplate}
                onFileSelect={handleFileSelect}
                onClearPreview={() => setImportPreview(null)}
                onConfirm={() => importPreview && bulkMut.mutate(importPreview.valid)}
              />

              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  ou cadastre manualmente
                </span>
              </div>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createMut.mutate(formDataToRecord(new FormData(e.currentTarget)));
                }}
              >
                <SchoolFormFields tipoEscola={tipoEscola} onTipoEscolaChange={setTipoEscola} />
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  Cadastrar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!editingSchool} onOpenChange={(o) => !o && setEditingSchool(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar escola</DialogTitle>
          </DialogHeader>
          {editingSchool && (
            <form
              key={editingSchool.id}
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                updateMut.mutate({
                  id: editingSchool.id,
                  vals: formDataToRecord(new FormData(e.currentTarget)),
                });
              }}
            >
              <SchoolFormFields
                tipoEscola={editTipoEscola}
                onTipoEscolaChange={setEditTipoEscola}
                defaults={{
                  nome: editingSchool.nome,
                  codigo_siger: editingSchool.codigo_siger ?? "",
                  codigo_inep: editingSchool.codigo_inep ?? "",
                  endereco: editingSchool.endereco ?? "",
                  bairro: editingSchool.bairro ?? "",
                  cep: editingSchool.cep ?? "",
                  regiao: editingSchool.regiao ?? "",
                  tipologia: editingSchool.tipologia ?? "",
                  email: editingSchool.email ?? "",
                  ramal: editingSchool.ramal ?? "",
                  diretor_nome: editingSchool.diretor_nome ?? "",
                  diretor_celular: editingSchool.diretor_celular ?? "",
                  diretor_cpf: editingSchool.diretor_cpf ?? "",
                }}
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
            <AlertDialogTitle>Excluir escola?</AlertDialogTitle>
            <AlertDialogDescription>
              A escola <strong>{deleteTarget?.nome}</strong> será removida da listagem. Esta ação não pode ser
              desfeita.
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
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_200px_180px]">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, SIGER ou INEP…"
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as typeof filterTipo)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="escola">Escola</SelectItem>
              <SelectItem value="emei">EMEI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regiao} onValueChange={setRegiao}>
            <SelectTrigger>
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as regiões</SelectItem>
              {regioes.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">SIGER</th>
                  <th className="px-4 py-3">INEP</th>
                  <th className="px-4 py-3">Região</th>
                  <th className="px-4 py-3">Diretor(a)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma escola.
                    </td>
                  </tr>
                )}
                {paginated.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{s.nome}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{schoolTipoLabels[s.tipo_escola ?? "escola"]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.codigo_siger ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.codigo_inep ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.regiao ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.diretor_nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "ativa" ? "default" : "secondary"}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Editar escola"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Excluir escola"
                          onClick={() => setDeleteTarget(s)}
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
            {paginated.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma escola.</div>
            )}
            {paginated.map((s) => (
              <div key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{s.nome}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {schoolTipoLabels[s.tipo_escola ?? "escola"]}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.regiao ?? "—"} • {s.diretor_nome ?? "Diretor não informado"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Editar escola"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Excluir escola"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage <= 1 || totalFiltered === 0}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="min-w-[7rem] text-center text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage >= totalPages || totalFiltered === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center text-sm sm:ml-auto sm:text-right">
              <span className="font-semibold text-[#0F172A]">{totalFiltered}</span>
              <span className="text-muted-foreground"> {totalFiltered === 1 ? "escola" : "escolas"}</span>
              {totalFiltered > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exibindo {showingFrom}–{showingTo}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SchoolFormFields({
  tipoEscola,
  onTipoEscolaChange,
  defaults = {},
}: {
  tipoEscola: "escola" | "emei";
  onTipoEscolaChange: (v: "escola" | "emei") => void;
  defaults?: Partial<Record<string, string>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Nome *</Label>
        <Input name="nome" required defaultValue={defaults.nome} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Tipo Escola *</Label>
        <input type="hidden" name="tipo_escola" value={tipoEscola} />
        <Select value={tipoEscola} onValueChange={(v) => onTipoEscolaChange(v as "escola" | "emei")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="escola">Escola</SelectItem>
            <SelectItem value="emei">EMEI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Código SIGER</Label>
        <Input name="codigo_siger" defaultValue={defaults.codigo_siger} />
      </div>
      <div className="space-y-1.5">
        <Label>Código INEP/MEC</Label>
        <Input name="codigo_inep" defaultValue={defaults.codigo_inep} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Endereço</Label>
        <Input name="endereco" defaultValue={defaults.endereco} />
      </div>
      <div className="space-y-1.5">
        <Label>Bairro</Label>
        <Input name="bairro" defaultValue={defaults.bairro} />
      </div>
      <div className="space-y-1.5">
        <Label>CEP</Label>
        <Input name="cep" defaultValue={defaults.cep} />
      </div>
      <div className="space-y-1.5">
        <Label>Região</Label>
        <Input name="regiao" defaultValue={defaults.regiao} />
      </div>
      <div className="space-y-1.5">
        <Label>Tipologia</Label>
        <Input name="tipologia" defaultValue={defaults.tipologia} />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input name="email" type="email" defaultValue={defaults.email} />
      </div>
      <div className="space-y-1.5">
        <Label>Ramal</Label>
        <Input name="ramal" defaultValue={defaults.ramal} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Diretor(a)</Label>
        <Input name="diretor_nome" defaultValue={defaults.diretor_nome} />
      </div>
      <div className="space-y-1.5">
        <Label>Celular diretor(a)</Label>
        <Input name="diretor_celular" defaultValue={defaults.diretor_celular} />
      </div>
      <div className="space-y-1.5">
        <Label>CPF/Matrícula</Label>
        <Input name="diretor_cpf" defaultValue={defaults.diretor_cpf} />
      </div>
    </div>
  );
}

function SchoolImportSection({
  fileInputRef,
  importPreview,
  parsingFile,
  confirming,
  onDownloadTemplate,
  onFileSelect,
  onClearPreview,
  onConfirm,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importPreview: SchoolImportPreview | null;
  parsingFile: boolean;
  confirming: boolean;
  onDownloadTemplate: () => void;
  onFileSelect: (file: File) => void;
  onClearPreview: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Importação em lote</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Baixe a planilha modelo, preencha os dados e faça o upload para cadastrar várias escolas de uma vez.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="flex-1" onClick={onDownloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Baixar planilha modelo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={parsingFile}
          onClick={() => fileInputRef.current?.click()}
        >
          {parsingFile ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Enviar planilha
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = "";
          }}
        />
      </div>

      {importPreview && (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="flex items-start gap-2">
            {importPreview.valid.length > 0 ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {importPreview.valid.length}{" "}
                {importPreview.valid.length === 1 ? "escola será cadastrada" : "escolas serão cadastradas"}
              </p>
              {importPreview.errors.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {importPreview.errors.length}{" "}
                  {importPreview.errors.length === 1 ? "linha ignorada" : "linhas ignoradas"} por erro de validação.
                </p>
              )}
            </div>
          </div>

          {importPreview.valid.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded border text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80 text-left">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Nome</th>
                    <th className="px-2 py-1.5 font-medium">Tipo</th>
                    <th className="px-2 py-1.5 font-medium">Região</th>
                    <th className="px-2 py-1.5 font-medium">SIGER</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importPreview.valid.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{row.nome}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{schoolTipoLabels[row.tipo_escola]}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.regiao ?? "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.codigo_siger ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.valid.length > 8 && (
                <p className="border-t px-2 py-1.5 text-muted-foreground">
                  + {importPreview.valid.length - 8} escola(s)…
                </p>
              )}
            </div>
          )}

          {importPreview.errors.length > 0 && (
            <ul className="max-h-24 space-y-1 overflow-y-auto text-xs text-destructive">
              {importPreview.errors.slice(0, 5).map((err, i) => (
                <li key={i}>
                  Linha {err.line}: {err.message}
                </li>
              ))}
              {importPreview.errors.length > 5 && (
                <li>… e mais {importPreview.errors.length - 5} erro(s)</li>
              )}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              disabled={importPreview.valid.length === 0 || confirming}
              onClick={onConfirm}
            >
              {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cadastro de {importPreview.valid.length}{" "}
              {importPreview.valid.length === 1 ? "escola" : "escolas"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClearPreview} disabled={confirming}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
