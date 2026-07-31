import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSeriesAdmin,
  fetchTurmasAdmin,
  makeCatalogValue,
  type CatalogRow,
} from "@/lib/serie-turma-catalog";

export const Route = createFileRoute("/_authenticated/escolas/serie-turma")({
  component: SerieTurmaPage,
});

type CatalogKind = "series" | "turmas";

function SerieTurmaPage() {
  const [tab, setTab] = useState<CatalogKind>("series");

  return (
    <div>
      <PageHeader
        title="Série / Turma"
        description="Cadastre as opções usadas nas listas suspensas de Acolhimento e Vivências."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CatalogKind)}>
        <TabsList>
          <TabsTrigger value="series">Séries</TabsTrigger>
          <TabsTrigger value="turmas">Turmas</TabsTrigger>
        </TabsList>
        <TabsContent value="series" className="mt-4">
          <CatalogPanel kind="series" />
        </TabsContent>
        <TabsContent value="turmas" className="mt-4">
          <CatalogPanel kind="turmas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogPanel({ kind }: { kind: CatalogKind }) {
  const qc = useQueryClient();
  const queryKey = kind === "series" ? ["school-series-admin"] : ["school-turmas-admin"];
  const table = kind === "series" ? "school_series" : "school_turmas";
  const title = kind === "series" ? "Série" : "Turma";

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => (kind === "series" ? fetchSeriesAdmin() : fetchTurmasAdmin()),
  });

  const activeRows = rows.filter((r) => !r.deleted_at);
  const deletedRows = rows.filter((r) => !!r.deleted_at);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<CatalogRow | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<CatalogRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setLabel("");
    setSortOrder(String((activeRows.at(-1)?.sort_order ?? 0) + 10));
    setFormOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditing(row);
    setLabel(row.label);
    setSortOrder(String(row.sort_order));
    setFormOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["catalog-series"] });
    qc.invalidateQueries({ queryKey: ["catalog-turmas"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error(`Informe o nome da ${title.toLowerCase()}.`);
      const order = Number.parseInt(sortOrder, 10);
      if (!Number.isFinite(order)) throw new Error("Ordem inválida.");

      if (editing) {
        const { data: updated, error: updErr } = await supabase
          .from(table)
          .update({ label: trimmed, sort_order: order })
          .eq("id", editing.id)
          .select("id")
          .maybeSingle();
        if (updErr) throw updErr;
        if (!updated) throw new Error("Não foi possível salvar. Verifique permissões de administrador.");
        return;
      }

      const value = makeCatalogValue(
        trimmed,
        rows.map((r) => r.value),
      );
      const { data: created, error: insErr } = await supabase
        .from(table)
        .insert({
          value,
          label: trimmed,
          sort_order: order,
        })
        .select("id")
        .maybeSingle();
      if (insErr) throw insErr;
      if (!created) throw new Error("Não foi possível cadastrar. Verifique permissões de administrador.");
    },
    onSuccess: () => {
      toast.success(editing ? `${title} atualizada.` : `${title} cadastrada.`);
      setFormOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (row: CatalogRow) => {
      const { data: updated, error: delErr } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("id, deleted_at")
        .maybeSingle();
      if (delErr) throw delErr;
      if (!updated?.deleted_at) {
        throw new Error("A exclusão não foi gravada no banco. Verifique permissões de administrador.");
      }
    },
    onSuccess: () => {
      toast.success(`${title} excluída da listagem ativa.`);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const restoreMut = useMutation({
    mutationFn: async (row: CatalogRow) => {
      const { data: updated, error: restErr } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq("id", row.id)
        .select("id, deleted_at")
        .maybeSingle();
      if (restErr) throw restErr;
      if (!updated || updated.deleted_at) {
        throw new Error("Não foi possível restaurar. Verifique permissões de administrador.");
      }
    },
    onSuccess: () => {
      toast.success(`${title} restaurada.`);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao restaurar", { description: e.message }),
  });

  const hardDeleteMut = useMutation({
    mutationFn: async (row: CatalogRow) => {
      const { data: removed, error: hardErr } = await supabase
        .from(table)
        .delete()
        .eq("id", row.id)
        .select("id")
        .maybeSingle();
      if (hardErr) throw hardErr;
      if (!removed) {
        throw new Error("A exclusão definitiva não foi gravada. Verifique permissões de administrador.");
      }
    },
    onSuccess: () => {
      toast.success(`${title} removida definitivamente do banco.`);
      setHardDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao excluir definitivamente", { description: e.message }),
  });

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {activeRows.length} {kind === "series" ? "série(s)" : "turma(s)"} ativa(s)
              {deletedRows.length > 0 ? ` · ${deletedRows.length} excluída(s)` : ""}
            </p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova {title.toLowerCase()}
            </Button>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              {(error as Error).message.includes("school_")
                ? "Execute scripts/fix-serie-turma-catalog.sql no Supabase."
                : (error as Error).message}
            </p>
          )}

          {!isLoading && !isError && activeRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item ativo cadastrado.</p>
          )}

          <div className="divide-y rounded-md border">
            {activeRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Código: {row.value} · Ordem: {row.sort_order}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {deletedRows.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-muted-foreground">Excluídas (ainda no banco)</p>
              <div className="divide-y rounded-md border border-dashed">
                {deletedRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-muted-foreground line-through">{row.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Código: {row.value} · Ordem: {row.sort_order}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => restoreMut.mutate(row)}
                        disabled={restoreMut.isPending}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Restaurar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setHardDeleteTarget(row)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Excluir definitivamente
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${title.toLowerCase()}` : `Nova ${title.toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-label">Nome *</Label>
              <Input
                id="catalog-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={kind === "series" ? "Ex.: 1º ano" : "Ex.: A"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-order">Ordem</Label>
              <Input
                id="catalog-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            {editing && (
              <p className="text-xs text-muted-foreground">
                Código interno: <span className="font-mono">{editing.value}</span> (não alterado)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {title.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.label}” sai das listas dos formulários, mas permanece no banco e pode ser
              restaurada depois. Demandas já registradas mantêm o texto antigo.
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

      <AlertDialog open={!!hardDeleteTarget} onOpenChange={(o) => !o && setHardDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              “{hardDeleteTarget?.label}” será removida do banco de dados de forma permanente. Essa ação
              não pode ser desfeita. Demandas antigas que já usaram esse texto continuam com o valor
              gravado nelas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => hardDeleteTarget && hardDeleteMut.mutate(hardDeleteTarget)}
              disabled={hardDeleteMut.isPending}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

