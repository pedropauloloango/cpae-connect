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
import { Pencil, Plus, Trash2 } from "lucide-react";
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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<CatalogRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setLabel("");
    setSortOrder(String((rows.at(-1)?.sort_order ?? 0) + 10));
    setFormOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditing(row);
    setLabel(row.label);
    setSortOrder(String(row.sort_order));
    setFormOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error(`Informe o nome da ${title.toLowerCase()}.`);
      const order = Number.parseInt(sortOrder, 10);
      if (!Number.isFinite(order)) throw new Error("Ordem inválida.");

      if (editing) {
        const { error: updErr } = await supabase
          .from(table)
          .update({ label: trimmed, sort_order: order })
          .eq("id", editing.id);
        if (updErr) throw updErr;
        return;
      }

      const value = makeCatalogValue(
        trimmed,
        rows.map((r) => r.value),
      );
      const { error: insErr } = await supabase.from(table).insert({
        value,
        label: trimmed,
        sort_order: order,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success(editing ? `${title} atualizada.` : `${title} cadastrada.`);
      setFormOpen(false);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["catalog-series"] });
      qc.invalidateQueries({ queryKey: ["catalog-turmas"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (row: CatalogRow) => {
      const { error: delErr } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      toast.success(`${title} excluída.`);
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["catalog-series"] });
      qc.invalidateQueries({ queryKey: ["catalog-turmas"] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {rows.length} {kind === "series" ? "série(s)" : "turma(s)"} ativa(s)
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

          {!isLoading && !isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
          )}

          <div className="divide-y rounded-md border">
            {rows.map((row) => (
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
              “{deleteTarget?.label}” deixará de aparecer nos formulários. Demandas já registradas
              mantêm o texto antigo.
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
    </>
  );
}
