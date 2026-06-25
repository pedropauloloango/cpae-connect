import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleRecordCard } from "@/components/ui/collapsible-record-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeetingRelatoDownload } from "@/components/meetings/MeetingRelatoDownload";
import { MeetingReferralOptionsDisplay } from "@/components/meetings/MeetingReferralOptionsField";
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";
import {
  MEETING_RELATO_ACCEPT,
  uploadClosureRelato,
  validateMeetingRelatoFile,
} from "@/lib/meeting-relato-upload";
import {
  complaintTypeLabels,
  closureResultLabels,
  closureResultSelectOptions,
  meetingNumberLabels,
  reportStatusCardTone,
  isRequestLockedForMeetingEdits,
} from "@/lib/labels";
import { MEETING_ORDER } from "@/lib/meeting-schedule";
import type { RequestAppointment } from "@/lib/meeting-schedule";
import { buildConsolidatedReportDraft } from "@/lib/consolidated-report";
import { exportConsolidatedReportPdf } from "@/lib/export-consolidated-report-pdf";
import { toast } from "sonner";
import { Check, CheckCircle2, Edit3, FileDown, FileText, MessageSquare, Paperclip, Pencil, Plus, RefreshCw, Send, X } from "lucide-react";

export type CaseClosureRow = {
  id: string;
  request_id: string;
  classificacao_final: string;
  resultado: string;
  parecer_final: string | null;
  relato_texto: string | null;
  relato_anexo_url: string | null;
  status: string;
  submitted_at: string | null;
  closed_by: string | null;
  created_at: string;
};

export type EncerramentoMeeting = {
  id: string;
  numero: string;
  status: string;
  data_atendimento: string;
  relato_texto: string | null;
  relato_anexo_url: string | null;
  observacoes: string | null;
  opcoes_encaminhamento: string[] | null;
};

type EncerramentoTabProps = {
  requestId: string;
  protocolo: string;
  escolaNome: string;
  alunoNome: string;
  requestStatus: string | null;
  closure: CaseClosureRow | null | undefined;
  meetings: EncerramentoMeeting[];
  appointments: RequestAppointment[];
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function EncerramentoTab({
  requestId,
  protocolo,
  escolaNome,
  alunoNome,
  requestStatus,
  closure,
  meetings,
  appointments,
}: EncerramentoTabProps) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [relatoMode, setRelatoMode] = useState<"texto" | "arquivo">("texto");
  const [relatoFile, setRelatoFile] = useState<File | null>(null);
  const [relatoTexto, setRelatoTexto] = useState("");
  const [classificacao, setClassificacao] = useState(closure?.classificacao_final ?? "");
  const [resultado, setResultado] = useState(closure?.resultado ?? "");
  const [formOpen, setFormOpen] = useState(false);

  const reportContext = useMemo(
    () => ({ protocolo, escolaNome, alunoNome }),
    [protocolo, escolaNome, alunoNome],
  );

  const buildDraft = () => buildConsolidatedReportDraft(reportContext, meetings, appointments);

  const handleExportPdf = (texto: string) => {
    if (!texto.trim()) {
      toast.error("Não há texto para exportar.");
      return;
    }
    try {
      exportConsolidatedReportPdf(reportContext, texto.trim());
    } catch (e) {
      toast.error("Erro ao exportar", { description: e instanceof Error ? e.message : "Tente novamente." });
    }
  };

  const registeredMeetings = meetings.filter((m) => m.status === "registrado" || m.status === "aprovado");
  const meetingByNumero = Object.fromEntries(meetings.map((m) => [m.numero, m]));
  const isConcluida = requestStatus === "concluida";
  const consolidatedExportText = closure?.relato_texto?.trim() || closure?.parecer_final?.trim() || "";

  const canEditClosure =
    !isRequestLockedForMeetingEdits(requestStatus) &&
    (!closure || closure.status === "rascunho" || closure.status === "correcao_solicitada" || closure.status === "rejeitado");

  const openFormModal = () => {
    setClassificacao(closure?.classificacao_final ?? "");
    setResultado(closure?.resultado ?? "");
    setRelatoMode(closure?.relato_anexo_url && !closure?.relato_texto ? "arquivo" : "texto");
    setRelatoFile(null);
    const saved = closure?.relato_texto?.trim();
    setRelatoTexto(saved ?? buildDraft());
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setRelatoFile(null);
    setRelatoTexto("");
  };

  const { data: correctionComment } = useQuery({
    queryKey: ["closure-correction", closure?.id],
    queryFn: async () => {
      if (!closure?.id) return null;
      const { data, error } = await supabase
        .from("approvals")
        .select("comentario, created_at")
        .eq("closure_id", closure.id)
        .eq("decision", "correcao_solicitada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.comentario ?? null;
    },
    enabled: !!closure?.id && closure.status === "correcao_solicitada",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["closure", requestId] });
    qc.invalidateQueries({ queryKey: ["request", requestId] });
    qc.invalidateQueries({ queryKey: ["logs", requestId] });
    qc.invalidateQueries({ queryKey: ["pending-approvals"] });
    qc.invalidateQueries({ queryKey: ["pending-corrections"] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  };

  const saveMut = useMutation({
    mutationFn: async (vals: {
      classificacao_final: string;
      resultado: string;
      relato_texto: string;
      relatoFile: File | null;
      relatoMode: "texto" | "arquivo";
      existingAnexo: string | null;
      closureId?: string;
    }) => {
      const hasText = vals.relatoMode === "texto" && vals.relato_texto.trim().length > 0;
      const hasNewFile = !!vals.relatoFile;
      const keepExistingFile = vals.relatoMode === "arquivo" && !hasNewFile && !!vals.existingAnexo;

      if (!hasText && !hasNewFile && !keepExistingFile) {
        throw new Error("Informe o relato circunstanciado em texto ou anexe o arquivo.");
      }
      if (!vals.classificacao_final || !vals.resultado) {
        throw new Error("Informe queixa final e status.");
      }
      if (vals.relatoFile) {
        const fileError = validateMeetingRelatoFile(vals.relatoFile);
        if (fileError) throw new Error(fileError);
      }

      let closureId = vals.closureId;
      if (!closureId) {
        const { data: created, error: createError } = await supabase
          .from("case_closures")
          .insert({
            request_id: requestId,
            classificacao_final: vals.classificacao_final as "ansiedade_depressao",
            resultado: vals.resultado as "concluido",
            status: "rascunho",
            closed_by: user?.id,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        closureId = created.id;
      }

      let relato_anexo_url: string | null = null;
      let relato_texto: string | null = null;

      if (vals.relatoMode === "texto") {
        relato_texto = vals.relato_texto.trim();
      } else if (hasNewFile && vals.relatoFile && user?.id) {
        relato_anexo_url = await uploadClosureRelato({
          file: vals.relatoFile,
          requestId,
          closureId,
          userId: user.id,
        });
      } else if (keepExistingFile) {
        relato_anexo_url = vals.existingAnexo;
      }

      const { error } = await supabase
        .from("case_closures")
        .update({
          classificacao_final: vals.classificacao_final as "ansiedade_depressao",
          resultado: vals.resultado as "concluido",
          relato_texto,
          relato_anexo_url,
          status: "rascunho",
          closed_by: user?.id,
        })
        .eq("id", closureId);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "relatorio_consolidado_salvo",
        details: { closure_id: closureId, com_anexo: !!relato_anexo_url },
      });
    },
    onSuccess: () => {
      toast.success("Relatório circunstanciado salvo.");
      invalidate();
      closeFormModal();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const sendMut = useMutation({
    mutationFn: async (c: CaseClosureRow) => {
      if (!c.relato_texto?.trim() && !c.relato_anexo_url) {
        throw new Error("Informe o relato circunstanciado antes de enviar para aprovação.");
      }
      const { error } = await supabase
        .from("case_closures")
        .update({ status: "aguardando_aprovacao", submitted_at: new Date().toISOString() })
        .eq("id", c.id);
      if (error) throw error;
      await supabase.from("requests").update({ status: "aguardando_aprovacao" }).eq("id", requestId);
      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "relatorio_enviado_aprovacao",
        details: { closure_id: c.id },
      });
    },
    onSuccess: () => {
      toast.success("Relatório circunstanciado enviado para aprovação.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const decideMut = useMutation({
    mutationFn: async ({
      closureId,
      decision,
      comentario,
      relatoTexto,
    }: {
      closureId: string;
      decision: "aprovado" | "rejeitado" | "correcao_solicitada";
      comentario?: string;
      relatoTexto: string | null;
    }) => {
      const newStatus =
        decision === "aprovado" ? "aprovado" : decision === "rejeitado" ? "rejeitado" : "correcao_solicitada";
      const { error: updateError } = await supabase
        .from("case_closures")
        .update({
          status: newStatus,
          ...(decision === "aprovado" ? { parecer_final: relatoTexto } : {}),
        })
        .eq("id", closureId);
      if (updateError) throw updateError;

      await supabase.from("approvals").insert({
        closure_id: closureId,
        reviewer_id: user?.id,
        decision,
        comentario,
      });

      if (decision === "aprovado") {
        await supabase.from("requests").update({ status: "concluida" }).eq("id", requestId);
      } else {
        await supabase.from("requests").update({ status: "em_ajuste" }).eq("id", requestId);
      }

      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: `aprovacao_relatorio_${decision}`,
        details: { closure_id: closureId, comentario },
      });
    },
    onSuccess: () => {
      toast.success("Decisão registrada.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const showCreateButton = !isAdmin && registeredMeetings.length > 0 && canEditClosure && !closure;
  const showProfessionalClosureActions =
    !isAdmin &&
    !!closure &&
    canEditClosure &&
    (closure.status === "rascunho" || closure.status === "correcao_solicitada" || closure.status === "rejeitado");

  const encerramentoHeader = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Encerramento</h2>
        <p className="text-sm text-muted-foreground">
          Elabore o relatório circunstanciado dos encontros registrados.
        </p>
      </div>
      {showCreateButton && (
        <Button size="sm" className="shrink-0" onClick={openFormModal}>
          <Plus className="mr-2 h-4 w-4" />
          Criar relatório circunstanciado
        </Button>
      )}
    </div>
  );

  const reportFormModal = (
    <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeFormModal())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{closure ? "Editar relatório circunstanciado" : "Criar relatório circunstanciado"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate({
              classificacao_final: classificacao,
              resultado,
              relato_texto: relatoMode === "texto" ? relatoTexto : "",
              relatoFile: relatoMode === "arquivo" ? relatoFile : null,
              relatoMode,
              existingAnexo: closure?.relato_anexo_url ?? null,
              closureId: closure?.id,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Queixa final *</Label>
              <Select value={classificacao} onValueChange={setClassificacao} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(complaintTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={resultado} onValueChange={setResultado} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {closureResultSelectOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-4">
            <Label>Relato circunstanciado dos encontros *</Label>
            <p className="text-xs text-muted-foreground">
              Elabore um relatório único que consolide os atendimentos registrados acima.
            </p>
            <RadioGroup
              value={relatoMode}
              onValueChange={(v) => {
                const mode = v as "texto" | "arquivo";
                setRelatoMode(mode);
                setRelatoFile(null);
                if (mode === "texto" && !relatoTexto.trim() && !closure?.relato_texto?.trim()) {
                  setRelatoTexto(buildDraft());
                }
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="texto" />
                Preencher relato aqui
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="arquivo" />
                Enviar arquivo do relato
              </label>
            </RadioGroup>

            {relatoMode === "texto" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="relato-consolidado">Texto do relato circunstanciado</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRelatoTexto(buildDraft())}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Gerar rascunho
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!relatoTexto.trim()}
                      onClick={() => handleExportPdf(relatoTexto)}
                    >
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      Exportar PDF
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="relato-consolidado"
                  rows={14}
                  required
                  value={relatoTexto}
                  onChange={(e) => setRelatoTexto(e.target.value)}
                  placeholder="Consolide aqui os relatos de todos os encontros realizados…"
                />
                <p className="text-xs text-muted-foreground">
                  O rascunho é montado automaticamente a partir das visitas agendadas e dos encontros registrados. Você pode editar livremente antes de salvar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="relato-arquivo-consolidado">Arquivo do relato circunstanciado</Label>
                {closure?.relato_anexo_url && !relatoFile && (
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <p className="mb-2 text-xs text-muted-foreground">Arquivo atual:</p>
                    <MeetingRelatoDownload storagePath={closure.relato_anexo_url} />
                  </div>
                )}
                <Input
                  id="relato-arquivo-consolidado"
                  type="file"
                  accept={MEETING_RELATO_ACCEPT}
                  onChange={(e) => setRelatoFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou DOCX — máximo 10 MB.</p>
                {relatoFile && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    {relatoFile.name}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeFormModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending || !classificacao || !resultado || (relatoMode === "texto" && !relatoTexto.trim())}>
              Salvar relatório
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (isConcluida || closure?.status === "aprovado") {
    return (
      <div className="space-y-4">
        {encerramentoHeader}
        <CollapsibleRecordCard
          className="border-l-4 border-l-success"
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Caso encerrado
            </span>
          }
        >
          {closure ? (
            <>
              <Field label="Queixa final" value={complaintTypeLabels[closure.classificacao_final]} />
              <Field label="Status" value={closureResultLabels[closure.resultado]} />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Relato circunstanciado</div>
                {consolidatedExportText && (
                  <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3">{consolidatedExportText}</div>
                )}
                {isConcluida && consolidatedExportText && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleExportPdf(consolidatedExportText)}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    Exportar PDF
                  </Button>
                )}
                {closure.relato_anexo_url && <MeetingRelatoDownload storagePath={closure.relato_anexo_url} />}
                {!consolidatedExportText && !closure.relato_anexo_url && (
                  <p className="mt-1 text-muted-foreground">Relato circunstanciado não disponível em texto.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Caso concluído.</p>
          )}
        </CollapsibleRecordCard>
        <MeetingsSummary meetings={meetings} meetingByNumero={meetingByNumero} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {encerramentoHeader}
      {reportFormModal}

      {closure && (
        <CollapsibleRecordCard
          className={`border-l-4 ${reportStatusCardTone[closure.status] ?? reportStatusCardTone.rascunho}`}
          title={
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Relatório circunstanciado
            </span>
          }
          headerActions={<MeetingStatusBadge status={closure.status} />}
        >
            <Field label="Queixa final" value={complaintTypeLabels[closure.classificacao_final]} />
            <Field label="Status" value={closureResultLabels[closure.resultado]} />

            {closure.status === "correcao_solicitada" && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="font-medium text-warning-foreground">Correção solicitada pelo administrador</p>
                {correctionComment ? (
                  <p className="mt-1 whitespace-pre-wrap">{correctionComment}</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">Ajuste o relatório circunstanciado e envie novamente.</p>
                )}
              </div>
            )}

            {closure.relato_texto && (
              <div className="space-y-2">
                <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{closure.relato_texto}</div>
                {!isRequestLockedForMeetingEdits(requestStatus) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportPdf(closure.relato_texto!)}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    Exportar PDF
                  </Button>
                )}
              </div>
            )}
            {closure.relato_anexo_url && <MeetingRelatoDownload storagePath={closure.relato_anexo_url} />}

            {showProfessionalClosureActions && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="button" size="sm" variant="outline" onClick={openFormModal}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar relatório circunstanciado
                </Button>
                <Button
                  size="sm"
                  onClick={() => sendMut.mutate(closure)}
                  disabled={sendMut.isPending || !(closure.relato_texto?.trim() || closure.relato_anexo_url)}
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Enviar para Aprovação
                </Button>
              </div>
            )}

            {isAdmin && closure.status === "aguardando_aprovacao" && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  onClick={() =>
                    decideMut.mutate({
                      closureId: closure.id,
                      decision: "aprovado",
                      relatoTexto: closure.relato_texto,
                    })
                  }
                  disabled={decideMut.isPending}
                >
                  <Check className="mr-1.5 h-4 w-4" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const c = prompt("Comentário (opcional):");
                    if (c === null) return;
                    decideMut.mutate({
                      closureId: closure.id,
                      decision: "correcao_solicitada",
                      comentario: c,
                      relatoTexto: closure.relato_texto,
                    });
                  }}
                  disabled={decideMut.isPending}
                >
                  <Edit3 className="mr-1.5 h-4 w-4" /> Solicitar correção
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const c = prompt("Motivo da rejeição:");
                    if (c === null || !c.trim()) return;
                    decideMut.mutate({
                      closureId: closure.id,
                      decision: "rejeitado",
                      comentario: c,
                      relatoTexto: closure.relato_texto,
                    });
                  }}
                  disabled={decideMut.isPending}
                >
                  <X className="mr-1.5 h-4 w-4" /> Rejeitar
                </Button>
              </div>
            )}
        </CollapsibleRecordCard>
      )}

      {isAdmin && !closure && registeredMeetings.length > 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aguardando o profissional elaborar e enviar o relatório circunstanciado.
          </CardContent>
        </Card>
      )}

      {registeredMeetings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Registre pelo menos um encontro na aba Encontros antes de elaborar o relatório circunstanciado.
          </CardContent>
        </Card>
      )}

      <MeetingsSummary meetings={meetings} meetingByNumero={meetingByNumero} />
    </div>
  );
}

function MeetingsSummary({
  meetings,
  meetingByNumero,
}: {
  meetings: EncerramentoMeeting[];
  meetingByNumero: Record<string, EncerramentoMeeting>;
}) {
  if (meetings.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Encontros registrados</h3>
      <div className="space-y-3">
        {[...MEETING_ORDER].reverse().map((numero) => {
          const meeting = meetingByNumero[numero];
          if (!meeting) return null;
          return (
            <CollapsibleRecordCard
              key={numero}
              title={
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {meetingNumberLabels[numero]}
                </span>
              }
              headerActions={<MeetingStatusBadge status={meeting.status} />}
            >
              <p className="text-xs text-muted-foreground">
                {new Date(meeting.data_atendimento).toLocaleString("pt-BR")}
              </p>
              {meeting.relato_texto && (
                <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{meeting.relato_texto}</div>
              )}
              {meeting.relato_anexo_url && <MeetingRelatoDownload storagePath={meeting.relato_anexo_url} />}
              <MeetingReferralOptionsDisplay values={meeting.opcoes_encaminhamento} />
              {meeting.observacoes && (
                <p className="text-xs text-muted-foreground">Obs: {meeting.observacoes}</p>
              )}
            </CollapsibleRecordCard>
          );
        })}
      </div>
    </div>
  );
}
