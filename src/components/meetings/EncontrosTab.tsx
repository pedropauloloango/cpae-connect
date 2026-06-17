import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import {
  meetingNumberLabels,
  meetingTypeLabels,
  reportStatusCardTone,
  schoolRepresentativeLabels,
  isRequestLockedForMeetingEdits,
} from "@/lib/labels";
import { AppointmentScheduledBadge, MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";
import {
  MEETING_RELATO_ACCEPT,
  uploadMeetingRelato,
  validateMeetingRelatoFile,
} from "@/lib/meeting-relato-upload";
import { VisitScheduleForm } from "@/components/meetings/VisitScheduleForm";
import {
  MeetingReferralOptionsDisplay,
  MeetingReferralOptionsField,
} from "@/components/meetings/MeetingReferralOptionsField";
import { appointmentToFormValues, updateVisitAppointment } from "@/lib/appointment-update";
import { prepareAppointmentDatetimes } from "@/lib/appointment-utils";
import {
  buildAppointmentTitle,
  MEETING_ORDER,
  type MeetingNumber,
  type RequestAppointment,
} from "@/lib/meeting-schedule";
import {
  normalizeMeetingReferralOptions,
  type MeetingReferralOption,
} from "@/lib/meeting-referral-options";
import { toast } from "sonner";
import { Calendar, MessageSquare, Paperclip, Pencil } from "lucide-react";

function meetingSaveErrorMessage(message: string): string {
  if (message.includes("report_status") && message.includes("registrado")) {
    return 'O status "registrado" ainda não existe no banco. Execute scripts/fix-meeting-registration-part1.sql e depois part2.sql no Supabase SQL Editor.';
  }
  if (message.includes("opcoes_encaminhamento")) {
    return "A coluna opcoes_encaminhamento ainda não existe no banco. Execute scripts/fix-meeting-registration-part2.sql no Supabase SQL Editor.";
  }
  return message;
}

export type EncontrosTabProps = {
  requestId: string;
  protocolo: string;
  escolaNome: string;
  schoolId: string | null;
  meetings: Array<Record<string, unknown>>;
  appointments: RequestAppointment[];
  professionalId: string | null;
  registerNumero: MeetingNumber | null;
  scheduleNumero: MeetingNumber | null;
  openRegisterForm: boolean;
  openScheduleForm: boolean;
  onOpenRegisterFormChange: (open: boolean) => void;
  onOpenScheduleFormChange: (open: boolean) => void;
  registerAppointment: RequestAppointment | null;
  requestStatus: string | null;
};

type EditableMeeting = {
  id: string;
  numero: string;
  status: string;
  relato_texto: string | null;
  relato_anexo_url: string | null;
  observacoes: string | null;
  opcoes_encaminhamento: string[] | null;
};

export function EncontrosTab({
  requestId,
  protocolo,
  escolaNome,
  schoolId,
  meetings,
  appointments,
  professionalId,
  registerNumero,
  scheduleNumero,
  openRegisterForm,
  openScheduleForm,
  onOpenRegisterFormChange,
  onOpenScheduleFormChange,
  registerAppointment,
  requestStatus,
}: EncontrosTabProps) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const meetingsLockedForProfessional = !isAdmin && isRequestLockedForMeetingEdits(requestStatus);
  const [relatoMode, setRelatoMode] = useState<"texto" | "arquivo">("texto");
  const [relatoFile, setRelatoFile] = useState<File | null>(null);
  const [referralOptions, setReferralOptions] = useState<MeetingReferralOption[]>([]);
  const [editingAppointment, setEditingAppointment] = useState<RequestAppointment | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<EditableMeeting | null>(null);

  useEffect(() => {
    if (meetingsLockedForProfessional) {
      setEditingAppointment(null);
      setEditingMeeting(null);
    }
  }, [meetingsLockedForProfessional]);

  useEffect(() => {
    if (openScheduleForm || openRegisterForm) {
      setEditingAppointment(null);
      setEditingMeeting(null);
    }
  }, [openScheduleForm, openRegisterForm]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["meetings", requestId] });
    qc.invalidateQueries({ queryKey: ["appointments", requestId] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["logs", requestId] });
    qc.invalidateQueries({ queryKey: ["request", requestId] });
    qc.invalidateQueries({ queryKey: ["pending-approvals"] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  };

  const resetRegisterForm = () => {
    onOpenRegisterFormChange(false);
    setRelatoMode("texto");
    setRelatoFile(null);
    setReferralOptions([]);
  };

  const resetMeetingEdit = () => {
    setEditingMeeting(null);
    setRelatoMode("texto");
    setRelatoFile(null);
    setReferralOptions([]);
  };

  const openMeetingEdit = (meeting: EditableMeeting) => {
    setEditingMeeting(meeting);
    setRelatoMode(meeting.relato_anexo_url && !meeting.relato_texto?.trim() ? "arquivo" : "texto");
    setRelatoFile(null);
    setReferralOptions(normalizeMeetingReferralOptions(meeting.opcoes_encaminhamento));
    setEditingAppointment(null);
    onOpenRegisterFormChange(false);
    onOpenScheduleFormChange(false);
  };

  const scheduleMut = useMutation({
    mutationFn: async (vals: {
      numero: MeetingNumber;
      representante_nome: string;
      representante_cargo: string;
      tipo: string;
      inicio: string;
      fim: string;
      observacoes: string;
    }) => {
      if (!professionalId) throw new Error("Esta demanda ainda não está atribuída a um profissional.");
      const { inicio, fim } = prepareAppointmentDatetimes(vals);
      const { error } = await supabase.from("appointments").insert({
        request_id: requestId,
        professional_id: professionalId,
        school_id: schoolId,
        numero: vals.numero,
        representante_nome: vals.representante_nome.trim(),
        representante_cargo: vals.representante_cargo as "diretor",
        titulo: buildAppointmentTitle({ protocolo, numero: vals.numero, escola: escolaNome }),
        tipo: vals.tipo as "acolhimento",
        inicio,
        fim,
        observacoes: vals.observacoes.trim() || null,
        created_by: user?.id,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "visita_agendada",
        details: { numero: vals.numero, tipo: vals.tipo, inicio, representante_nome: vals.representante_nome.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Visita agendada na escola.");
      invalidateAll();
      onOpenScheduleFormChange(false);
    },
    onError: (e: Error) => toast.error("Erro ao agendar", { description: e.message }),
  });

  const updateScheduleMut = useMutation({
    mutationFn: async (vals: { appointment: RequestAppointment; values: Parameters<typeof updateVisitAppointment>[0]["values"] }) => {
      await updateVisitAppointment({
        appointmentId: vals.appointment.id,
        values: vals.values,
        requestId,
        protocolo,
        escolaNome,
        numero: vals.appointment.numero,
        actorId: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Agendamento atualizado.");
      invalidateAll();
      setEditingAppointment(null);
    },
    onError: (e: Error) => toast.error("Erro ao editar", { description: e.message }),
  });

  const createMut = useMutation({
    mutationFn: async (vals: {
      numero: MeetingNumber;
      appointmentId: string;
      tipo: string;
      data_atendimento: string;
      relato_texto: string;
      observacoes: string;
      relatoFile: File | null;
      opcoes_encaminhamento: MeetingReferralOption[];
    }) => {
      const hasText = vals.relato_texto.trim().length > 0;
      const hasFile = !!vals.relatoFile;
      if (!hasText && !hasFile) {
        throw new Error("Informe o relato em texto ou anexe o arquivo preenchido.");
      }
      if (vals.relatoFile) {
        const fileError = validateMeetingRelatoFile(vals.relatoFile);
        if (fileError) throw new Error(fileError);
      }

      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert({
          request_id: requestId,
          professional_id: professionalId,
          appointment_id: vals.appointmentId,
          numero: vals.numero,
          tipo: vals.tipo as "acolhimento",
          data_atendimento: vals.data_atendimento,
          relato_texto: hasText ? vals.relato_texto.trim() : null,
          observacoes: vals.observacoes || null,
          opcoes_encaminhamento: vals.opcoes_encaminhamento,
          status: "registrado",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (vals.relatoFile && user?.id) {
        const storagePath = await uploadMeetingRelato({
          file: vals.relatoFile,
          requestId,
          meetingId: meeting.id,
          userId: user.id,
        });
        const { error: updateError } = await supabase
          .from("meetings")
          .update({ relato_anexo_url: storagePath })
          .eq("id", meeting.id);
        if (updateError) throw updateError;
      }

      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "encontro_registrado",
        details: { numero: vals.numero, com_anexo: hasFile },
      });
      await supabase.from("requests").update({ status: "em_andamento" }).eq("id", requestId);
    },
    onSuccess: () => {
      toast.success("Encontro registrado.");
      invalidateAll();
      resetRegisterForm();
    },
    onError: (e: Error) => toast.error("Erro", { description: meetingSaveErrorMessage(e.message) }),
  });

  const updateMeetingMut = useMutation({
    mutationFn: async (vals: {
      meetingId: string;
      relato_texto: string;
      observacoes: string;
      relatoFile: File | null;
      relatoMode: "texto" | "arquivo";
      existingAnexo: string | null;
      opcoes_encaminhamento: MeetingReferralOption[];
    }) => {
      const hasText = vals.relatoMode === "texto" && vals.relato_texto.trim().length > 0;
      const hasNewFile = !!vals.relatoFile;
      const keepExistingFile = vals.relatoMode === "arquivo" && !hasNewFile && !!vals.existingAnexo;

      if (!hasText && !hasNewFile && !keepExistingFile) {
        throw new Error("Informe o relato em texto ou anexe o arquivo preenchido.");
      }
      if (vals.relatoFile) {
        const fileError = validateMeetingRelatoFile(vals.relatoFile);
        if (fileError) throw new Error(fileError);
      }

      let relato_anexo_url: string | null = null;
      let relato_texto: string | null = null;

      if (vals.relatoMode === "texto") {
        relato_texto = vals.relato_texto.trim();
      } else if (hasNewFile && user?.id) {
        relato_anexo_url = await uploadMeetingRelato({
          file: vals.relatoFile,
          requestId,
          meetingId: vals.meetingId,
          userId: user.id,
        });
      } else if (keepExistingFile) {
        relato_anexo_url = vals.existingAnexo;
      }

      const { error } = await supabase
        .from("meetings")
        .update({
          relato_texto,
          relato_anexo_url,
          observacoes: vals.observacoes.trim() || null,
          opcoes_encaminhamento: vals.opcoes_encaminhamento,
          status: "registrado",
        })
        .eq("id", vals.meetingId);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: "encontro_atualizado",
        details: { meeting_id: vals.meetingId },
      });
    },
    onSuccess: () => {
      toast.success("Encontro atualizado.");
      invalidateAll();
      resetMeetingEdit();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: meetingSaveErrorMessage(e.message) }),
  });

  const appointmentByNumero = Object.fromEntries(
    appointments.filter((a) => a.numero).map((a) => [a.numero!, a]),
  );
  const meetingByNumero = Object.fromEntries(meetings.map((m) => [m.numero as string, m]));
  const hasAnyContent = meetings.length > 0 || appointments.length > 0;

  return (
    <div className="space-y-4">
      {!hasAnyContent && !openScheduleForm && !openRegisterForm && !editingAppointment && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Agende a visita na escola antes de registrar o primeiro encontro.
          </CardContent>
        </Card>
      )}

      {[...MEETING_ORDER].reverse().map((numero) => {
        const appointment = appointmentByNumero[numero];
        const meeting = meetingByNumero[numero] as
          | {
              id: string;
              numero: string;
              status: string;
              data_atendimento: string;
              relato_texto: string | null;
              relato_anexo_url: string | null;
              observacoes: string | null;
              opcoes_encaminhamento: string[] | null;
            }
          | undefined;

        if (!appointment && !meeting) return null;

        return (
          <div key={numero} className="space-y-3">
            {appointment && (
              <CollapsibleRecordCard
                className="border-primary/20 bg-primary/[0.02]"
                title={
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Visita agendada — {meetingNumberLabels[numero]}
                  </span>
                }
                headerActions={
                  <>
                    {!meeting && !isAdmin && !meetingsLockedForProfessional && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setEditingAppointment(appointment);
                          onOpenScheduleFormChange(false);
                          onOpenRegisterFormChange(false);
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}
                    <AppointmentScheduledBadge />
                  </>
                }
              >
                <div className="space-y-1">
                  <p>
                    <span className="text-muted-foreground">Representante:</span>{" "}
                    {appointment.representante_nome ?? "—"}
                    {appointment.representante_cargo
                      ? ` (${schoolRepresentativeLabels[appointment.representante_cargo]})`
                      : ""}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tipo:</span> {meetingTypeLabels[appointment.tipo]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Data/hora:</span>{" "}
                    {new Date(appointment.inicio).toLocaleString("pt-BR")}
                    {appointment.fim ? ` — ${new Date(appointment.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                  {appointment.observacoes && (
                    <p className="text-xs text-muted-foreground">Obs: {appointment.observacoes}</p>
                  )}
                </div>
              </CollapsibleRecordCard>
            )}

            {meeting && (
              <CollapsibleRecordCard
                className={`border-l-4 ${reportStatusCardTone[meeting.status] ?? reportStatusCardTone.registrado}`}
                title={
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {meetingNumberLabels[meeting.numero]}
                  </span>
                }
                headerActions={<MeetingStatusBadge status={meeting.status} />}
                forceOpen={editingMeeting?.id === meeting.id}
              >
                <div className="text-muted-foreground">
                  {new Date(meeting.data_atendimento).toLocaleString("pt-BR")}
                </div>

                {editingMeeting?.id === meeting.id ? (
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        updateMeetingMut.mutate({
                          meetingId: meeting.id,
                          relato_texto: relatoMode === "texto" ? String(f.get("relato") ?? "") : "",
                          observacoes: String(f.get("obs") ?? ""),
                          relatoFile: relatoMode === "arquivo" ? relatoFile : null,
                          relatoMode,
                          existingAnexo: meeting.relato_anexo_url,
                          opcoes_encaminhamento: referralOptions,
                        });
                      }}
                    >
                      <div className="space-y-3 rounded-md border border-border p-4">
                        <Label>Relato do encontro *</Label>
                        <RadioGroup
                          value={relatoMode}
                          onValueChange={(v) => {
                            setRelatoMode(v as "texto" | "arquivo");
                            setRelatoFile(null);
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
                          <div className="space-y-1.5">
                            <Label htmlFor={`relato-edit-${meeting.id}`}>Texto do relato</Label>
                            <Textarea
                              id={`relato-edit-${meeting.id}`}
                              name="relato"
                              rows={6}
                              required
                              defaultValue={meeting.relato_texto ?? ""}
                              placeholder="Descreva o atendimento realizado…"
                            />
                            <MeetingReferralOptionsField
                              value={referralOptions}
                              onChange={setReferralOptions}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor={`relato-arquivo-edit-${meeting.id}`}>Arquivo do relato</Label>
                            {meeting.relato_anexo_url && !relatoFile && (
                              <div className="rounded-md border border-border bg-muted/30 p-2">
                                <p className="mb-2 text-xs text-muted-foreground">Arquivo atual:</p>
                                <MeetingRelatoDownload storagePath={meeting.relato_anexo_url} />
                              </div>
                            )}
                            <Input
                              id={`relato-arquivo-edit-${meeting.id}`}
                              type="file"
                              accept={MEETING_RELATO_ACCEPT}
                              onChange={(e) => setRelatoFile(e.target.files?.[0] ?? null)}
                            />
                            <p className="text-xs text-muted-foreground">
                              PDF, JPG, PNG ou DOCX — máximo 10 MB. Deixe em branco para manter o arquivo atual.
                            </p>
                            {relatoFile && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Paperclip className="h-3.5 w-3.5" />
                                {relatoFile.name}
                              </p>
                            )}
                          </div>
                        )}
                        {relatoMode === "arquivo" && (
                          <MeetingReferralOptionsField
                            value={referralOptions}
                            onChange={setReferralOptions}
                          />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>Observações</Label>
                        <Textarea name="obs" rows={2} defaultValue={meeting.observacoes ?? ""} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateMeetingMut.isPending}>
                          Salvar alterações
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetMeetingEdit}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {meeting.relato_texto && (
                        <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{meeting.relato_texto}</div>
                      )}
                      {meeting.relato_anexo_url && <MeetingRelatoDownload storagePath={meeting.relato_anexo_url} />}
                      <MeetingReferralOptionsDisplay values={meeting.opcoes_encaminhamento} />
                      {!meeting.relato_texto && !meeting.relato_anexo_url && (
                        <p className="text-xs text-muted-foreground">Relato ainda não informado.</p>
                      )}
                      {meeting.observacoes && (
                        <div className="text-xs text-muted-foreground">Obs: {meeting.observacoes}</div>
                      )}
                      {!isAdmin && meeting.status === "registrado" && !meetingsLockedForProfessional && (
                        <Button size="sm" variant="outline" onClick={() => openMeetingEdit(meeting)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar relato
                        </Button>
                      )}
                    </>
                  )}
              </CollapsibleRecordCard>
            )}
          </div>
        );
      })}

      {scheduleNumero && openScheduleForm && !editingAppointment && !meetingsLockedForProfessional && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Agendar visita — {meetingNumberLabels[scheduleNumero]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Entre em contato com o representante da escola (Diretor, Adjunto ou Secretário) e registre
              o agendamento da visita. O compromisso aparecerá na sua agenda e na agenda do administrador.
            </p>
            <VisitScheduleForm
              submitLabel="Confirmar agendamento"
              isPending={scheduleMut.isPending}
              disabled={!professionalId}
              disabledMessage={!isAdmin && !professionalId ? "Esta demanda ainda não está atribuída a um profissional." : undefined}
              onCancel={() => onOpenScheduleFormChange(false)}
              onSubmit={(values) =>
                scheduleMut.mutate({
                  numero: scheduleNumero,
                  representante_nome: values.representante_nome,
                  representante_cargo: values.representante_cargo,
                  tipo: values.tipo,
                  inicio: values.inicio,
                  fim: values.fim,
                  observacoes: values.observacoes,
                })
              }
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!isAdmin && !!editingAppointment && !meetingsLockedForProfessional}
        onOpenChange={(open) => {
          if (!open) setEditingAppointment(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editingAppointment && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Editar agendamento —{" "}
                  {editingAppointment.numero ? meetingNumberLabels[editingAppointment.numero] : "Visita"}
                </DialogTitle>
              </DialogHeader>
              <VisitScheduleForm
                formKey={editingAppointment.id}
                defaultValues={appointmentToFormValues(editingAppointment)}
                submitLabel="Salvar alterações"
                isPending={updateScheduleMut.isPending}
                onCancel={() => setEditingAppointment(null)}
                onSubmit={(values) =>
                  updateScheduleMut.mutate({ appointment: editingAppointment, values })
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!(registerNumero && registerAppointment && openRegisterForm && !editingAppointment && !meetingsLockedForProfessional)}
        onOpenChange={(open) => {
          if (!open) resetRegisterForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {registerNumero && registerAppointment && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar {meetingNumberLabels[registerNumero]}</DialogTitle>
              </DialogHeader>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Visita agendada</p>
                <p className="mt-1 text-muted-foreground">
                  {meetingTypeLabels[registerAppointment.tipo]} •{" "}
                  {new Date(registerAppointment.inicio).toLocaleString("pt-BR")}
                </p>
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  createMut.mutate({
                    numero: registerNumero,
                    appointmentId: registerAppointment.id,
                    tipo: registerAppointment.tipo,
                    data_atendimento: registerAppointment.inicio,
                    relato_texto: relatoMode === "texto" ? String(f.get("relato") ?? "") : "",
                    observacoes: String(f.get("obs") ?? ""),
                    relatoFile: relatoMode === "arquivo" ? relatoFile : null,
                    opcoes_encaminhamento: referralOptions,
                  });
                }}
              >
                <div className="space-y-3 rounded-md border border-border p-4">
                  <Label>Relato do encontro *</Label>
                  <RadioGroup
                    value={relatoMode}
                    onValueChange={(v) => {
                      setRelatoMode(v as "texto" | "arquivo");
                      setRelatoFile(null);
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
                    <div className="space-y-1.5">
                      <Label htmlFor="relato-texto">Texto do relato</Label>
                      <Textarea
                        id="relato-texto"
                        name="relato"
                        rows={6}
                        required
                        key={openRegisterForm ? registerNumero : "closed"}
                        placeholder="Descreva o atendimento realizado…"
                      />
                      <MeetingReferralOptionsField
                        value={referralOptions}
                        onChange={setReferralOptions}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="relato-arquivo">Arquivo do relato</Label>
                      <Input
                        id="relato-arquivo"
                        type="file"
                        accept={MEETING_RELATO_ACCEPT}
                        required={!relatoFile}
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
                  {relatoMode === "arquivo" && (
                    <MeetingReferralOptionsField
                      value={referralOptions}
                      onChange={setReferralOptions}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea name="obs" rows={2} />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={resetRegisterForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMut.isPending}>
                    Registrar encontro
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
