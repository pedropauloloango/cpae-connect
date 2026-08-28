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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { encontroStatusLabels } from "@/lib/saude-mental-options";
import {
  buildPresencaQrFilename,
  buildPresencaQrUrl,
  downloadQrCodePng,
  isRecebimentoPresencaAtivo,
} from "@/lib/saude-mental-presenca";
import { exportListaPresencaPrint } from "@/lib/saude-mental-lista-presenca";
import { Check, Copy, Download, FileDown, Loader2, QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/presenca")({
  component: SaudeMentalPresencaPage,
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

type Inscrito = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  escola_texto: string | null;
  school_nome_snapshot: string | null;
};

type Presenca = {
  id: string;
  encontro_id: string;
  inscrito_id: string;
  origem: string;
  registrado_em: string;
};

function formatHorario(value: string): string {
  return value.slice(0, 5);
}

function formatDataBr(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function SaudeMentalPresencaPage() {
  const qc = useQueryClient();
  const [encontroId, setEncontroId] = useState<string>("");
  const [filterNome, setFilterNome] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());
  const [draftSyncedKey, setDraftSyncedKey] = useState<string>("");
  const qrSvgWrapRef = useRef<HTMLDivElement>(null);

  const { data: encontros = [], isLoading: loadingEncontros } = useQuery({
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
  });

  const encontro = encontros.find((e) => e.id === encontroId) ?? null;

  const { data: inscritos = [], isLoading: loadingInscritos } = useQuery({
    queryKey: ["saude-mental-inscritos-presenca", encontro?.ano_curso],
    enabled: !!encontro,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_inscritos")
        .select("id, nome_completo, cpf, escola_texto, school_nome_snapshot")
        .eq("ano_curso", encontro!.ano_curso)
        .is("deleted_at", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Inscrito[];
    },
  });

  const { data: presencas = [], isLoading: loadingPresencas } = useQuery({
    queryKey: ["saude-mental-presencas", encontroId],
    enabled: !!encontroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_presencas")
        .select("id, encontro_id, inscrito_id, origem, registrado_em")
        .eq("encontro_id", encontroId);
      if (error) throw error;
      return (data ?? []) as Presenca[];
    },
  });

  const savedPresentIds = useMemo(
    () => new Set(presencas.map((p) => p.inscrito_id)),
    [presencas],
  );

  // Sincroniza rascunho com o que já está salvo ao trocar encontro / carregar
  useEffect(() => {
    if (!encontroId || loadingPresencas) return;
    const key = `${encontroId}:${[...savedPresentIds].sort().join(",")}`;
    if (key === draftSyncedKey) return;
    setDraftSelected(new Set(savedPresentIds));
    setDraftSyncedKey(key);
  }, [encontroId, loadingPresencas, savedPresentIds, draftSyncedKey]);

  useEffect(() => {
    setFilterNome("");
    setDraftSyncedKey("");
    setDraftSelected(new Set());
  }, [encontroId]);

  const filtered = useMemo(() => {
    const t = filterNome.trim().toLowerCase();
    if (!t) return inscritos;
    return inscritos.filter((i) => i.nome_completo.toLowerCase().includes(t));
  }, [inscritos, filterNome]);

  const qrUrl = encontro ? buildPresencaQrUrl(encontro.qr_token) : "";
  const recebimentoAberto = encontro ? isRecebimentoPresencaAtivo(encontro) : false;

  const toAdd = useMemo(
    () => [...draftSelected].filter((id) => !savedPresentIds.has(id)),
    [draftSelected, savedPresentIds],
  );
  const toRemove = useMemo(
    () => [...savedPresentIds].filter((id) => !draftSelected.has(id)),
    [draftSelected, savedPresentIds],
  );
  const hasPendingChanges = toAdd.length > 0 || toRemove.length > 0;

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!encontroId) throw new Error("Selecione um encontro.");

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("saude_mental_presencas")
          .delete()
          .eq("encontro_id", encontroId)
          .in("inscrito_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const payload = toAdd.map((inscritoId) => {
          const inscrito = inscritos.find((i) => i.id === inscritoId);
          return {
            encontro_id: encontroId,
            inscrito_id: inscritoId,
            cpf_informado: inscrito?.cpf ?? null,
            origem: "manual" as const,
          };
        });
        const { error } = await supabase.from("saude_mental_presencas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Presenças confirmadas.");
      void qc.invalidateQueries({ queryKey: ["saude-mental-presencas", encontroId] });
      setDraftSyncedKey("");
    },
    onError: (e: Error) => toast.error("Erro ao confirmar", { description: e.message }),
  });

  const toggleDraft = (inscritoId: string, checked: boolean) => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(inscritoId);
      else next.delete(inscritoId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      for (const i of filtered) next.add(i.id);
      return next;
    });
  };

  const clearFiltered = () => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      for (const i of filtered) next.delete(i.id);
      return next;
    });
  };

  const handleExport = () => {
    if (!encontro) return;
    try {
      exportListaPresencaPrint(
        {
          modulo_curso: encontro.modulo_curso,
          data: encontro.data,
          horario: encontro.horario,
          local: encontro.local,
          ano_curso: encontro.ano_curso,
        },
        inscritos.map((i) => ({
          nome_completo: i.nome_completo,
          cpf: i.cpf,
          escola: i.school_nome_snapshot ?? i.escola_texto,
          presente: draftSelected.has(i.id),
        })),
      );
    } catch (e) {
      toast.error("Erro ao exportar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const presentesCount = draftSelected.size;
  const isLoading = loadingEncontros || (!!encontro && (loadingInscritos || loadingPresencas));

  return (
    <div>
      <PageHeader
        title="Presença"
        description="Marque os participantes e confirme as presenças no final."
        actions={
          encontro ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleExport}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar lista
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQrOpen(true)}
                title="Exibir QR Code do encontro"
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR Code
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>Encontro</Label>
              <Select value={encontroId || undefined} onValueChange={setEncontroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o encontro" />
                </SelectTrigger>
                <SelectContent>
                  {encontros.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.modulo_curso} · {formatDataBr(e.data)} · {formatHorario(e.horario)} ·{" "}
                      {e.local}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {encontro && (
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <Badge variant="outline">
                  {encontroStatusLabels[encontro.status] ?? encontro.status}
                </Badge>
                <Badge variant={recebimentoAberto ? "default" : "secondary"}>
                  Recebimento {recebimentoAberto ? "aberto" : "fechado"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {presentesCount}/{inscritos.length} selecionados
                  {hasPendingChanges ? " · alterações pendentes" : ""}
                </span>
              </div>
            )}
          </div>

          {!encontroId ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecione um encontro para registrar presenças.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Filtrar por nome…"
                    value={filterNome}
                    onChange={(e) => setFilterNome(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                    Marcar filtrados
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearFiltered}>
                    Desmarcar filtrados
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                    <FileDown className="mr-1.5 h-4 w-4" />
                    Exportar lista
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!hasPendingChanges || confirmMut.isPending}
                    onClick={() => confirmMut.mutate()}
                  >
                    {confirmMut.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-4 w-4" />
                    )}
                    Confirmar presenças
                    {hasPendingChanges
                      ? ` (${toAdd.length > 0 ? `+${toAdd.length}` : ""}${
                          toAdd.length && toRemove.length ? " " : ""
                        }${toRemove.length > 0 ? `−${toRemove.length}` : ""})`
                      : ""}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="w-14 px-3 py-2 font-medium">Presença</th>
                      <th className="px-3 py-2 font-medium">Nome</th>
                      <th className="px-3 py-2 font-medium">CPF</th>
                      <th className="px-3 py-2 font-medium">Escola</th>
                      <th className="px-3 py-2 font-medium">Salvo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                          Carregando…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhum inscrito encontrado para o ano {encontro?.ano_curso}.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((i) => {
                        const selected = draftSelected.has(i.id);
                        const saved = savedPresentIds.has(i.id);
                        const presenca = presencas.find((p) => p.inscrito_id === i.id);
                        return (
                          <tr
                            key={i.id}
                            className={cn(
                              "border-t",
                              selected && "bg-emerald-50/40",
                              selected !== saved && "bg-amber-50/50",
                            )}
                          >
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={selected}
                                disabled={confirmMut.isPending}
                                onCheckedChange={(checked) =>
                                  toggleDraft(i.id, checked === true)
                                }
                                aria-label={`Presença de ${i.nome_completo}`}
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">{i.nome_completo}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {i.cpf ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {i.school_nome_snapshot ?? i.escola_texto ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {saved
                                ? presenca?.origem === "qrcode"
                                  ? "QR Code"
                                  : "Manual"
                                : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!hasPendingChanges || confirmMut.isPending}
                  onClick={() => confirmMut.mutate()}
                >
                  {confirmMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Confirmar presenças
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code — presença</DialogTitle>
          </DialogHeader>
          {encontro && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {encontro.modulo_curso} · {formatDataBr(encontro.data)} ·{" "}
                {formatHorario(encontro.horario)} · {encontro.local}
              </p>
              <div ref={qrSvgWrapRef} className="mx-auto w-fit rounded-xl bg-white p-4">
                <QRCode value={qrUrl} size={200} />
              </div>
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
                        modulo_curso: encontro.modulo_curso,
                        data: encontro.data,
                        qr_token: encontro.qr_token,
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
