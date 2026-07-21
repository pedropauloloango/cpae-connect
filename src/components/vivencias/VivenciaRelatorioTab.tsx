import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";
import { periodoLabels } from "@/lib/acolhimento-options";
import { vivenciaTemaLabel } from "@/lib/vivencias-options";
import { isRequestLockedForMeetingEdits } from "@/lib/labels";
import { toast } from "sonner";
import { Loader2, Send, Check, X, MessageSquare } from "lucide-react";
import {
  PENDING_VIVENCIA_APPROVALS_QUERY_KEY,
  PENDING_VIVENCIA_CORRECTIONS_QUERY_KEY,
} from "@/lib/pending-vivencias";

export type VivenciaReportRow = {
  id: string;
  vivencia_request_id: string;
  unidade_escolar: string | null;
  ano: string | null;
  turma: string | null;
  turno: string | null;
  data_vivencia: string | null;
  tema: string | null;
  quantitativo_alunos: number | null;
  tecnicos_cpae: string | null;
  relato_atendimento: string;
  direcao: string | null;
  coordenacao: string | null;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  review_comment: string | null;
  created_at: string;
};

type GroupOption = {
  id: string;
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[] | null;
  data_preferivel: string | null;
};

type VivenciaRelatorioTabProps = {
  requestId: string;
  requestStatus: string;
  schoolNome: string | null;
  groups: GroupOption[];
  assigneeNames: string[];
  canFill: boolean;
  autoStartCreate?: boolean;
  onAutoStartCreateHandled?: () => void;
};

type FormState = {
  unidade_escolar: string;
  ano: string;
  turma: string;
  turno: string;
  data_vivencia: string;
  tema: string;
  quantitativo_alunos: string;
  tecnicos_cpae: string;
  relato_atendimento: string;
  direcao: string;
  coordenacao: string;
};

function defaultsFromDemand(props: {
  schoolNome: string | null;
  groups: GroupOption[];
  assigneeNames: string[];
}): FormState {
  const g = props.groups[0];
  const temas = (g?.temas ?? []).map((t) => vivenciaTemaLabel(t)).filter(Boolean);
  return {
    unidade_escolar: props.schoolNome ?? "",
    ano: g?.aluno_serie ?? "",
    turma: g?.aluno_turma ?? "",
    turno: g?.periodo ?? "",
    data_vivencia: g?.data_preferivel ?? "",
    tema: temas.join("; "),
    quantitativo_alunos: "",
    tecnicos_cpae: props.assigneeNames.join("\n"),
    relato_atendimento: "",
    direcao: "",
    coordenacao: "",
  };
}

function formFromReport(r: VivenciaReportRow): FormState {
  return {
    unidade_escolar: r.unidade_escolar ?? "",
    ano: r.ano ?? "",
    turma: r.turma ?? "",
    turno: r.turno ?? "",
    data_vivencia: r.data_vivencia ?? "",
    tema: r.tema ?? "",
    quantitativo_alunos: r.quantitativo_alunos != null ? String(r.quantitativo_alunos) : "",
    tecnicos_cpae: r.tecnicos_cpae ?? "",
    relato_atendimento: r.relato_atendimento ?? "",
    direcao: r.direcao ?? "",
    coordenacao: r.coordenacao ?? "",
  };
}

function FieldView({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap text-sm font-medium text-[#0F172A]">{value || "—"}</div>
    </div>
  );
}

export function VivenciaRelatorioTab({
  requestId,
  requestStatus,
  schoolNome,
  groups,
  assigneeNames,
  canFill,
  autoStartCreate = false,
  onAutoStartCreateHandled,
}: VivenciaRelatorioTabProps) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [editing, setEditing] = useState(autoStartCreate);
  const [reviewComment, setReviewComment] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    defaultsFromDemand({ schoolNome, groups, assigneeNames }),
  );

  const { data: report, isPending } = useQuery({
    queryKey: ["vivencia-report", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vivencia_reports")
        .select("*")
        .eq("vivencia_request_id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data as VivenciaReportRow | null;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (report && !editing) setForm(formFromReport(report));
  }, [report, editing]);

  useEffect(() => {
    if (!autoStartCreate) return;
    if (report) {
      onAutoStartCreateHandled?.();
      return;
    }
    setForm(defaultsFromDemand({ schoolNome, groups, assigneeNames }));
    setEditing(true);
    onAutoStartCreateHandled?.();
  }, [autoStartCreate, report, schoolNome, groups, assigneeNames, onAutoStartCreateHandled]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vivencia-report", requestId] });
    qc.invalidateQueries({ queryKey: ["vivencia-request", requestId] });
    qc.invalidateQueries({ queryKey: ["vivencia-logs", requestId] });
    qc.invalidateQueries({ queryKey: ["vivencias-demandas"] });
    qc.invalidateQueries({ queryKey: PENDING_VIVENCIA_APPROVALS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: PENDING_VIVENCIA_CORRECTIONS_QUERY_KEY });
  };

  const lockedByRequest = isRequestLockedForMeetingEdits(requestStatus);
  const canEditReport =
    canFill &&
    !lockedByRequest &&
    (!report ||
      report.status === "rascunho" ||
      report.status === "rejeitado" ||
      report.status === "correcao_solicitada");

  const reportLocked =
    !!report &&
    (report.status === "aguardando_aprovacao" || report.status === "aprovado");

  const patchForm = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const toPayload = () => {
    const qty = form.quantitativo_alunos.trim();
    const quantitativo = qty === "" ? null : Number(qty);
    if (qty === "" || !Number.isFinite(quantitativo) || (quantitativo ?? 0) < 0) {
      throw new Error("Informe o quantitativo de alunos na vivência.");
    }
    if (!form.unidade_escolar.trim()) throw new Error("Informe a unidade escolar.");
    if (!form.relato_atendimento.trim()) throw new Error("Preencha o relatório de atendimento.");
    return {
      unidade_escolar: form.unidade_escolar.trim(),
      ano: form.ano.trim() || null,
      turma: form.turma.trim() || null,
      turno: form.turno.trim() || null,
      data_vivencia: form.data_vivencia || null,
      tema: form.tema.trim() || null,
      quantitativo_alunos: quantitativo,
      tecnicos_cpae: form.tecnicos_cpae.trim() || null,
      relato_atendimento: form.relato_atendimento.trim(),
      direcao: form.direcao.trim() || null,
      coordenacao: form.coordenacao.trim() || null,
    };
  };

  const saveMut = useMutation({
    mutationFn: async (andSend: boolean) => {
      const payload = toPayload();

      if (!report) {
        const { data: created, error } = await supabase
          .from("vivencia_reports")
          .insert({
            vivencia_request_id: requestId,
            ...payload,
            status: andSend ? "aguardando_aprovacao" : "rascunho",
            submitted_at: andSend ? new Date().toISOString() : null,
            submitted_by: andSend ? user?.id : null,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "Já existe um relatório para esta demanda. Atualize a página para evitar duplicidade.",
            );
          }
          throw error;
        }

        if (andSend) {
          await supabase
            .from("vivencia_requests")
            .update({ status: "aguardando_aprovacao" })
            .eq("id", requestId);
        }

        await supabase.from("vivencia_activity_logs").insert({
          vivencia_request_id: requestId,
          actor_id: user?.id,
          action: andSend ? "relatorio_enviado_aprovacao" : "relatorio_salvo",
          details: { report_id: created.id },
        });
        return;
      }

      if (reportLocked) {
        throw new Error("Este relatório já foi enviado e não pode ser alterado.");
      }

      const { error } = await supabase
        .from("vivencia_reports")
        .update({
          ...payload,
          status: andSend ? "aguardando_aprovacao" : "rascunho",
          submitted_at: andSend ? new Date().toISOString() : report.submitted_at,
          submitted_by: andSend ? user?.id : report.submitted_by,
          review_comment: andSend ? null : report.review_comment,
        })
        .eq("id", report.id);
      if (error) throw error;

      if (andSend) {
        await supabase
          .from("vivencia_requests")
          .update({ status: "aguardando_aprovacao" })
          .eq("id", requestId);
      }

      await supabase.from("vivencia_activity_logs").insert({
        vivencia_request_id: requestId,
        actor_id: user?.id,
        action: andSend ? "relatorio_enviado_aprovacao" : "relatorio_salvo",
        details: { report_id: report.id },
      });
    },
    onSuccess: (_d, andSend) => {
      toast.success(andSend ? "Relatório enviado para validação." : "Relatório salvo como rascunho.");
      setEditing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const decideMut = useMutation({
    mutationFn: async (decision: "aprovado" | "rejeitado" | "correcao_solicitada") => {
      if (!report) throw new Error("Relatório não encontrado.");
      if (decision === "rejeitado" && !reviewComment.trim()) {
        throw new Error("Informe o motivo da rejeição.");
      }
      const newStatus = decision;
      const { error } = await supabase
        .from("vivencia_reports")
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          review_comment: reviewComment.trim() || null,
        })
        .eq("id", report.id);
      if (error) throw error;

      await supabase
        .from("vivencia_requests")
        .update({
          status: decision === "aprovado" ? "concluida" : "em_ajuste",
        })
        .eq("id", requestId);

      await supabase.from("vivencia_activity_logs").insert({
        vivencia_request_id: requestId,
        actor_id: user?.id,
        action: `aprovacao_relatorio_${decision}`,
        details: { report_id: report.id, comentario: reviewComment.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Decisão registrada.");
      setReviewComment("");
      setRejectMode(false);
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const startEdit = () => {
    if (report) setForm(formFromReport(report));
    setEditing(true);
  };

  if (isPending && !editing && !autoStartCreate) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando relatório...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Protocolo diário de Vivências escolares
          </h2>
          <p className="text-sm text-muted-foreground">
            Relatório de atendimento conforme o modelo oficial. Um único relatório por demanda —
            após o envio para validação, os demais profissionais não podem preencher novamente.
          </p>
        </div>
        {report && <MeetingStatusBadge status={report.status} />}
      </div>

      {reportLocked && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-3 text-sm text-amber-950">
            Relatório já enviado
            {report?.status === "aprovado" ? " e aprovado" : " para validação"}. Edição bloqueada
            para evitar duplicidade.
          </CardContent>
        </Card>
      )}

      {!report && !editing && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              Ainda não há relatório de vivência para esta demanda.
            </p>
            {canEditReport ? (
              <p className="text-sm text-muted-foreground">
                Use o botão <strong>Criar relatório de Vivências escolares</strong> na aba
                Informações para iniciar o preenchimento.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Aguardando o profissional atribuído criar e enviar o relatório."
                  : "Somente profissionais atribuídos a esta demanda podem criar o relatório."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(editing || report) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do protocolo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing && canEditReport ? (
              <>
                {groups.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>Turma da demanda (apenas visualização)</Label>
                    <Select
                      onValueChange={(groupId) => {
                        const g = groups.find((x) => x.id === groupId);
                        if (!g) return;
                        const temas = (g.temas ?? [])
                          .map((t) => vivenciaTemaLabel(t))
                          .filter(Boolean);
                        patchForm({
                          ano: g.aluno_serie,
                          turma: g.aluno_turma,
                          turno: g.periodo,
                          data_vivencia: g.data_preferivel ?? "",
                          tema: temas.join("; "),
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar turma da demanda…" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g, i) => (
                          <SelectItem key={g.id} value={g.id}>
                            Turma {i + 1}: {g.aluno_serie} {g.aluno_turma} (
                            {periodoLabels[g.periodo] ?? g.periodo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Unidade escolar *</Label>
                  <Input value={form.unidade_escolar} readOnly disabled className="bg-muted" />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Ano</Label>
                    <Input value={form.ano} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Turma</Label>
                    <Input value={form.turma} readOnly disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Turno</Label>
                    <Input
                      value={form.turno ? (periodoLabels[form.turno] ?? form.turno) : ""}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.data_vivencia}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tema</Label>
                  <Input value={form.tema} readOnly disabled className="bg-muted" />
                </div>

                <div className="space-y-1.5">
                  <Label>Técnicos CPAE</Label>
                  <Textarea
                    rows={3}
                    value={form.tecnicos_cpae}
                    readOnly
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Relatório de atendimento *</Label>
                  <Textarea
                    rows={12}
                    value={form.relato_atendimento}
                    onChange={(e) => patchForm({ relato_atendimento: e.target.value })}
                    placeholder="Descreva o atendimento realizado…"
                  />
                </div>

                <div className="space-y-1.5 sm:max-w-xs">
                  <Label>Quantitativo de alunos na vivência *</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={form.quantitativo_alunos}
                    onChange={(e) => patchForm({ quantitativo_alunos: e.target.value })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Direção</Label>
                    <Input
                      value={form.direcao}
                      onChange={(e) => patchForm({ direcao: e.target.value })}
                      placeholder="Nome do representante"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coordenação</Label>
                    <Input
                      value={form.coordenacao}
                      onChange={(e) => patchForm({ coordenacao: e.target.value })}
                      placeholder="Nome do representante"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate(false)}
                  >
                    {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar rascunho
                  </Button>
                  <Button
                    type="button"
                    disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate(true)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar para validação
                  </Button>
                  {report && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditing(false);
                        setForm(formFromReport(report));
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </>
            ) : report ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldView label="Unidade escolar" value={report.unidade_escolar} />
                  <FieldView
                    label="Data"
                    value={
                      report.data_vivencia
                        ? new Date(`${report.data_vivencia}T12:00:00`).toLocaleDateString("pt-BR")
                        : null
                    }
                  />
                  <FieldView label="Ano" value={report.ano} />
                  <FieldView label="Turma" value={report.turma} />
                  <FieldView
                    label="Turno"
                    value={report.turno ? (periodoLabels[report.turno] ?? report.turno) : null}
                  />
                  <FieldView
                    label="Quantitativo de alunos"
                    value={
                      report.quantitativo_alunos != null ? String(report.quantitativo_alunos) : null
                    }
                  />
                </div>
                <FieldView label="Tema" value={report.tema} />
                <FieldView label="Técnicos CPAE" value={report.tecnicos_cpae} />
                <FieldView label="Relatório de atendimento" value={report.relato_atendimento} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldView label="Direção" value={report.direcao} />
                  <FieldView label="Coordenação" value={report.coordenacao} />
                </div>
                {report.review_comment && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm">
                    <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-950">
                      <MessageSquare className="h-4 w-4" />
                      Comentário da validação
                    </div>
                    {report.review_comment}
                  </div>
                )}
                {canEditReport && (
                  <Button type="button" variant="outline" onClick={startEdit}>
                    Editar relatório
                  </Button>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {isAdmin && report?.status === "aguardando_aprovacao" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validação do administrador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rejectMode && (
              <div className="space-y-1.5">
                <Label>Motivo da rejeição *</Label>
                <Textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Descreva o motivo da rejeição…"
                  autoFocus
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!rejectMode ? (
                <>
                  <Button
                    type="button"
                    disabled={decideMut.isPending}
                    onClick={() => decideMut.mutate("aprovado")}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={decideMut.isPending}
                    onClick={() => decideMut.mutate("correcao_solicitada")}
                  >
                    Solicitar correção
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={decideMut.isPending}
                    onClick={() => setRejectMode(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Rejeitar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={decideMut.isPending || !reviewComment.trim()}
                    onClick={() => decideMut.mutate("rejeitado")}
                  >
                    {decideMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar rejeição
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={decideMut.isPending}
                    onClick={() => {
                      setRejectMode(false);
                      setReviewComment("");
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
