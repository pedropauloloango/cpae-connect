export const MEETING_ORDER = ["primeiro", "segundo", "terceiro"] as const;

export type MeetingNumber = (typeof MEETING_ORDER)[number];

export type RequestAppointment = {
  id: string;
  numero: MeetingNumber | null;
  tipo: string;
  inicio: string;
  fim: string;
  representante_cargo: string | null;
  representante_nome: string | null;
  observacoes: string | null;
  created_at?: string | null;
};

export type RequestMeeting = {
  id: string;
  numero: string;
  appointment_id?: string | null;
};

export type NextEncontroAction =
  | { type: "schedule"; numero: MeetingNumber }
  | { type: "register"; numero: MeetingNumber; appointment: RequestAppointment }
  | null;

/** Próxima visita ainda sem agendamento (independente de encontros pendentes de registro). */
export function getNextScheduleNumero(appointments: RequestAppointment[]): MeetingNumber | null {
  for (const numero of MEETING_ORDER) {
    if (!appointments.some((a) => a.numero === numero)) return numero;
  }
  return null;
}

/** Próximo encontro com visita agendada mas ainda sem registro de relato. */
export function getNextRegisterAction(
  appointments: RequestAppointment[],
  meetings: RequestMeeting[],
): { numero: MeetingNumber; appointment: RequestAppointment } | null {
  for (const numero of MEETING_ORDER) {
    if (meetings.some((m) => m.numero === numero)) continue;
    const appointment = appointments.find((a) => a.numero === numero);
    if (appointment) return { numero, appointment };
  }
  return null;
}

/** @deprecated Prefira getNextScheduleNumero e getNextRegisterAction em paralelo. */
export function getNextEncontroAction(
  appointments: RequestAppointment[],
  meetings: RequestMeeting[],
): NextEncontroAction {
  const register = getNextRegisterAction(appointments, meetings);
  if (register) return { type: "register", ...register };
  const schedule = getNextScheduleNumero(appointments);
  if (schedule) return { type: "schedule", numero: schedule };
  return null;
}

export function buildAppointmentTitle(params: {
  protocolo: string;
  numero: MeetingNumber;
  escola: string;
}): string {
  const labels: Record<MeetingNumber, string> = {
    primeiro: "1º Encontro",
    segundo: "2º Encontro",
    terceiro: "3º Encontro",
  };
  return `${params.protocolo} — ${labels[params.numero]} — ${params.escola}`;
}
