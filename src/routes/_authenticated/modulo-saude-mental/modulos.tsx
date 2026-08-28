import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  encontroStatusLabels,
  encontroStatusOptions,
  moduloCursoOptions,
  qrRecebimentoDuracaoOptions,
} from "@/lib/saude-mental-options";
import {
  buildPresencaQrFilename,
  buildPresencaQrUrl,
  downloadQrCodePng,
  formatRemainingMs,
  isQrUsingLocalhost,
  isRecebimentoPresencaAtivo,
} from "@/lib/saude-mental-presenca";
import { Copy, Download, Loader2, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/modulos")({
  component: SaudeMentalModulosPage,
});

type Encontro = {
  id: string;
  data: string;
  horario: string;
  local: string;
  modulo_curso: string;
  status: string;
  ano_curso: number;
  qr_token: string;
  qr_ativo: boolean;
  qr_expires_at: string | null;
};

type FormState = {
  data: string;
  horario: string;
  local: string;
  modulo_curso: string;
  status: string;
  ano_curso: string;
};

function emptyForm(): FormState {
  return {
    data: "",
    horario: "08:00",
    local: "",
    modulo_curso: "Módulo 1",
    status: "pendente",
    ano_curso: String(new Date().getFullYear()),
  };
}

function formatHorario(value: string): string {
  return value.slice(0, 5);
}

const HORARIO_HORAS = Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, "0"));
const HORARIO_MINUTOS = ["00", "15", "30", "45"] as const;

function snapHorarioToQuarter(value: string): string {
  const hhmm = formatHorario(value);
  const [hRaw = "08", mRaw = "00"] = hhmm.split(":");
  const hNum = Math.min(20, Math.max(7, Number(hRaw) || 8));
  const h = String(hNum).padStart(2, "0");
  const mNum = Number(mRaw);
  const snapped =
    HORARIO_MINUTOS.find((m) => Number(m) === mNum) ??
    HORARIO_MINUTOS.reduce((best, m) =>
      Math.abs(Number(m) - mNum) < Math.abs(Number(best) - mNum) ? m : best,
    );
  return `${h}:${snapped}`;
}

function formatDataBr(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function toForm(row: Encontro): FormState {
  return {
    data: row.data,
    horario: snapHorarioToQuarter(row.horario),
    local: row.local,
    modulo_curso: row.modulo_curso,
    status: row.status,
    ano_curso: String(row.ano_curso),
  };
}

function SaudeMentalModulosPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Encontro | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Encontro | null>(null);
  const [qrTargetId, setQrTargetId] = useState<string | null>(null);
  const [duracaoMin, setDuracaoMin] = useState("10");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const qrSvgWrapRef = useRef<HTMLDivElement>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["saude-mental-encontros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_encontros")
        .select(
          "id, data, horario, local, modulo_curso, status, ano_curso, qr_token, qr_ativo, qr_expires_at",
        )
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("horario", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Encontro[];
    },
    refetchInterval: 15_000,
  });

  const qrTarget = useMemo(
    () => rows.find((r) => r.id === qrTargetId) ?? null,
    [rows, qrTargetId],
  );

  const qrUrl = useMemo(
    () => (qrTarget ? buildPresencaQrUrl(qrTarget.qr_token) : ""),
    [qrTarget],
  );

  const recebimentoAberto = qrTarget ? isRecebimentoPresencaAtivo(qrTarget) : false;
  const remainingMs =
    qrTarget?.qr_expires_at && recebimentoAberto
      ? Math.max(0, new Date(qrTarget.qr_expires_at).getTime() - nowTick)
      : 0;

  useEffect(() => {
    if (!qrTargetId || !recebimentoAberto) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [qrTargetId, recebimentoAberto]);

  useEffect(() => {
    if (!qrTarget || !qrTarget.qr_ativo || !qrTarget.qr_expires_at) return;
    if (new Date(qrTarget.qr_expires_at).getTime() > Date.now()) return;
    // Janela acabou na UI — sincroniza lista
    void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
  }, [nowTick, qrTarget, qc]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: Encontro) => {
    setEditing(row);
    setForm(toForm(row));
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.data) throw new Error("Informe a data.");
      if (!form.horario) throw new Error("Informe o horário.");
      if (!form.local.trim()) throw new Error("Informe o local.");
      if (!form.modulo_curso.trim()) throw new Error("Informe o módulo do curso.");
      const ano = Number(form.ano_curso);
      if (!Number.isFinite(ano) || ano < 2000) throw new Error("Informe um ano do curso válido.");

      const payload = {
        data: form.data,
        horario: form.horario.length === 5 ? `${form.horario}:00` : form.horario,
        local: form.local.trim(),
        modulo_curso: form.modulo_curso.trim(),
        status: form.status,
        ano_curso: ano,
      };

      if (editing) {
        const { error } = await supabase
          .from("saude_mental_encontros")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("saude_mental_encontros").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Encontro atualizado." : "Encontro adicionado.");
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("saude_mental_encontros")
        ? "Banco desatualizado. Execute scripts/add-saude-mental-encontros-presenca.sql no Supabase."
        : e.message;
      toast.error("Erro ao salvar", { description: msg });
    },
  });

  const activateMut = useMutation({
    mutationFn: async ({ id, minutos }: { id: string; minutos: number }) => {
      const expires = new Date(Date.now() + minutos * 60_000).toISOString();
      const { error } = await supabase
        .from("saude_mental_encontros")
        .update({ qr_ativo: true, qr_expires_at: expires })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Recebimento ativo por ${vars.minutos} minutos.`);
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
      setNowTick(Date.now());
    },
    onError: (e: Error) => {
      const msg = e.message.includes("qr_expires_at")
        ? "Banco desatualizado. Execute scripts/add-saude-mental-qr-expires.sql no Supabase."
        : e.message;
      toast.error("Erro ao ativar", { description: msg });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saude_mental_encontros")
        .update({ qr_ativo: false, qr_expires_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento de presença desativado.");
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
    },
    onError: (e: Error) => toast.error("Erro ao desativar", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (row: Encontro) => {
      const { error } = await supabase
        .from("saude_mental_encontros")
        .update({ deleted_at: new Date().toISOString(), qr_ativo: false, qr_expires_at: null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encontro excluído.");
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Módulos — Encontros"
        description="Encontros do Curso de Saúde Mental na Educação."
      />

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="space-y-4 pt-6">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar encontro
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Horário</th>
                  <th className="px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2 font-medium">Módulo do curso</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Recebimento</th>
                  <th className="px-3 py-2 font-medium">QR Code</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum encontro cadastrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const aberto = isRecebimentoPresencaAtivo(row);
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{formatDataBr(row.data)}</td>
                        <td className="px-3 py-2">{formatHorario(row.horario)}</td>
                        <td className="px-3 py-2">{row.local}</td>
                        <td className="px-3 py-2 font-medium">{row.modulo_curso}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={row.status === "realizado" ? "default" : "outline"}
                            className={
                              row.status === "realizado"
                                ? "bg-emerald-600 hover:bg-emerald-600"
                                : "border-amber-300 bg-amber-50 text-amber-800"
                            }
                          >
                            {encontroStatusLabels[row.status] ?? row.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={aberto ? "default" : "secondary"}
                            className={aberto ? "bg-emerald-600 hover:bg-emerald-600" : undefined}
                          >
                            {aberto ? "Aberto" : "Fechado"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDuracaoMin("10");
                              setQrTargetId(row.id);
                            }}
                            title="Ver QR Code e gerenciar recebimento"
                          >
                            <QrCode className="mr-1.5 h-4 w-4" />
                            QR Code
                          </Button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar encontro" : "Adicionar encontro"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={form.horario.slice(0, 2)}
                    onValueChange={(hora) =>
                      setForm((f) => ({
                        ...f,
                        horario: `${hora}:${f.horario.slice(3, 5) || "00"}`,
                      }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {HORARIO_HORAS.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">:</span>
                  <Select
                    value={form.horario.slice(3, 5)}
                    onValueChange={(minuto) =>
                      setForm((f) => ({
                        ...f,
                        horario: `${f.horario.slice(0, 2) || "08"}:${minuto}`,
                      }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {HORARIO_MINUTOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Local</Label>
              <Input
                value={form.local}
                onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                placeholder="Ex.: Auditório SEMED"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Módulo do curso</Label>
                <Select
                  value={form.modulo_curso}
                  onValueChange={(v) => setForm((f) => ({ ...f, modulo_curso: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduloCursoOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {encontroStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ano do curso</Label>
              <Input
                type="number"
                min={2020}
                max={2100}
                value={form.ano_curso}
                onChange={(e) => setForm((f) => ({ ...f, ano_curso: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O QR Code fica disponível após salvar. A liberação de presença é feita na hora do
              evento, pelo botão QR Code.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrTarget} onOpenChange={(o) => !o && setQrTargetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code — presença</DialogTitle>
          </DialogHeader>
          {qrTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {qrTarget.modulo_curso} · {formatDataBr(qrTarget.data)} ·{" "}
                {formatHorario(qrTarget.horario)} · {qrTarget.local}
              </p>
              <div
                ref={qrSvgWrapRef}
                className="mx-auto w-fit rounded-xl border bg-white p-4"
              >
                <QRCode value={qrUrl} size={200} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Gere/imprima o QR com antecedência. A confirmação só funciona após liberar o
                recebimento. Cada encontro tem um QR exclusivo.
              </p>
              {isQrUsingLocalhost(qrUrl) && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Este QR aponta para localhost e não abre no celular. Defina{" "}
                  <code className="font-mono">VITE_APP_URL</code> no{" "}
                  <code className="font-mono">.env</code> com a URL pública (ex.: Vercel) e
                  reinicie o <code className="font-mono">npm run dev</code>.
                </p>
              )}
              <div className="flex gap-2">
                <Input readOnly value={qrUrl} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Copiar link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(qrUrl);
                    toast.success("Link copiado.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  const svg = qrSvgWrapRef.current?.querySelector("svg");
                  if (!svg) {
                    toast.error("QR Code não encontrado.");
                    return;
                  }
                  try {
                    await downloadQrCodePng(
                      svg,
                      buildPresencaQrFilename({
                        modulo_curso: qrTarget.modulo_curso,
                        data: qrTarget.data,
                        qr_token: qrTarget.qr_token,
                      }),
                    );
                    toast.success("Download iniciado.");
                  } catch (e) {
                    toast.error("Erro ao baixar", {
                      description: e instanceof Error ? e.message : undefined,
                    });
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar imagem do QR Code
              </Button>

              <div className="space-y-3 rounded-lg border p-3">
                {recebimentoAberto ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-emerald-700">Recebimento ativo</p>
                        <p className="text-xs text-muted-foreground">
                          Encerra automaticamente em{" "}
                          <span className="font-mono font-semibold text-foreground">
                            {formatRemainingMs(remainingMs)}
                          </span>
                        </p>
                      </div>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Aberto</Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={deactivateMut.isPending}
                      onClick={() => deactivateMut.mutate(qrTarget.id)}
                    >
                      {deactivateMut.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Desativar agora
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Tempo de liberação</Label>
                      <Select value={duracaoMin} onValueChange={setDuracaoMin}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {qrRecebimentoDuracaoOptions.map((o) => (
                            <SelectItem key={o.value} value={String(o.value)}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={activateMut.isPending}
                      onClick={() =>
                        activateMut.mutate({
                          id: qrTarget.id,
                          minutos: Number(duracaoMin),
                        })
                      }
                    >
                      {activateMut.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Ativar recebimento de presença
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir encontro?</AlertDialogTitle>
            <AlertDialogDescription>
              O encontro e o QR Code associados deixarão de aparecer na listagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
