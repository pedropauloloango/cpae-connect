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

export function getNextEncontroAction(
  appointments: RequestAppointment[],
  meetings: RequestMeeting[],
): NextEncontroAction {
  for (const numero of MEETING_ORDER) {
    if (meetings.some((m) => m.numero === numero)) continue;
    const appointment = appointments.find((a) => a.numero === numero);
    if (!appointment) return { type: "schedule", numero };
    return { type: "register", numero, appointment };
  }
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
