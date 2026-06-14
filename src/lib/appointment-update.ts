import { supabase } from "@/integrations/supabase/client";
import { toDatetimeLocalValue, prepareAppointmentDatetimes, type VisitScheduleFormValues } from "@/lib/appointment-utils";
import { buildAppointmentTitle, type MeetingNumber } from "@/lib/meeting-schedule";

export async function updateVisitAppointment(params: {
  appointmentId: string;
  values: VisitScheduleFormValues;
  requestId?: string | null;
  protocolo?: string;
  escolaNome?: string;
  numero?: MeetingNumber | null;
  actorId?: string | null;
}) {
  const { values, appointmentId, requestId, protocolo, escolaNome, numero, actorId } = params;
  const { inicio, fim } = prepareAppointmentDatetimes(values);

  const updatePayload: Record<string, unknown> = {
    representante_nome: values.representante_nome.trim(),
    representante_cargo: values.representante_cargo,
    tipo: values.tipo,
    inicio,
    fim,
    observacoes: values.observacoes.trim() || null,
  };

  if (protocolo && escolaNome && numero) {
    updatePayload.titulo = buildAppointmentTitle({ protocolo, numero, escola: escolaNome });
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", appointmentId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível atualizar o agendamento.");

  if (requestId) {
    await supabase.from("activity_logs").insert({
      request_id: requestId,
      actor_id: actorId ?? null,
      action: "visita_agendada_editada",
      details: {
        appointment_id: appointmentId,
        numero,
        tipo: values.tipo,
        inicio,
        representante_nome: values.representante_nome.trim(),
      },
    });
  }
}

export function appointmentToFormValues(a: {
  representante_nome: string | null;
  representante_cargo: string | null;
  tipo: string;
  inicio: string;
  fim: string;
  observacoes: string | null;
}): VisitScheduleFormValues {
  return {
    representante_nome: a.representante_nome ?? "",
    representante_cargo: a.representante_cargo ?? "diretor",
    tipo: a.tipo,
    inicio: toDatetimeLocalValue(a.inicio),
    fim: toDatetimeLocalValue(a.fim),
    observacoes: a.observacoes ?? "",
  };
}
