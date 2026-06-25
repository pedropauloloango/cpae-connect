import {
  meetingNumberLabels,
  meetingTypeLabels,
  schoolRepresentativeLabels,
} from "@/lib/labels";
import { formatMeetingReferralOptions } from "@/lib/meeting-referral-options";
import { MEETING_ORDER, type MeetingNumber, type RequestAppointment } from "@/lib/meeting-schedule";

export type ConsolidatedReportContext = {
  protocolo: string;
  escolaNome: string;
  alunoNome: string;
};

export type ConsolidatedReportMeeting = {
  numero: string;
  status: string;
  data_atendimento: string;
  relato_texto: string | null;
  relato_anexo_url: string | null;
  observacoes: string | null;
  opcoes_encaminhamento: string[] | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRepresentante(appointment: RequestAppointment): string {
  const cargo = appointment.representante_cargo
    ? (schoolRepresentativeLabels[appointment.representante_cargo] ?? appointment.representante_cargo)
    : "representante";
  const nome = appointment.representante_nome?.trim();
  return nome ? `${cargo} ${nome}` : cargo;
}

function isRegisteredMeeting(meeting: ConsolidatedReportMeeting): boolean {
  return meeting.status === "registrado" || meeting.status === "aprovado";
}

function relatoBody(meeting: ConsolidatedReportMeeting): string {
  if (meeting.relato_texto?.trim()) return meeting.relato_texto.trim();
  if (meeting.relato_anexo_url) return "[Relato registrado em arquivo anexo]";
  return "[Relato não informado em texto]";
}

function appendReferralsAndObs(lines: string[], meeting: ConsolidatedReportMeeting) {
  const referrals = formatMeetingReferralOptions(meeting.opcoes_encaminhamento);
  if (referrals) {
    lines.push("");
    lines.push(`Encaminhamentos indicados: ${referrals}.`);
  }
  if (meeting.observacoes?.trim()) {
    lines.push("");
    lines.push(`Observações: ${meeting.observacoes.trim()}`);
  }
}

function buildPrimeiroEncontroSection(
  appointment: RequestAppointment | undefined,
  meeting: ConsolidatedReportMeeting | undefined,
  ctx: ConsolidatedReportContext,
): string[] {
  const lines: string[] = [];

  if (appointment) {
    const tipoVisita = (meetingTypeLabels[appointment.tipo] ?? appointment.tipo).toLowerCase();
    const representante = formatRepresentante(appointment);
    const contactDay = appointment.created_at
      ? formatDate(appointment.created_at)
      : formatDate(appointment.inicio);

    if (appointment.observacoes?.trim()) {
      lines.push(appointment.observacoes.trim());
    } else {
      lines.push(
        `No dia ${contactDay} foi realizado contato com a escola ${ctx.escolaNome} com o ${representante} sobre o caso do(a) aluno(a) ${ctx.alunoNome}, ficando agendada a visita de ${tipoVisita} para ${formatDateTime(appointment.inicio)}.`,
      );
    }
    lines.push("");
  }

  if (meeting && isRegisteredMeeting(meeting)) {
    lines.push(
      `No dia ${formatDateTime(meeting.data_atendimento)} visitei a escola e colhi o seguinte relato do ${meetingNumberLabels[meeting.numero]}:`,
    );
    lines.push("");
    lines.push(`"${relatoBody(meeting)}"`);
    appendReferralsAndObs(lines, meeting);
    lines.push("");
  }

  return lines;
}

function buildDemaisEncontrosSection(
  numero: MeetingNumber,
  appointment: RequestAppointment | undefined,
  meeting: ConsolidatedReportMeeting | undefined,
): string[] {
  const lines: string[] = [];
  const label = meetingNumberLabels[numero];

  if (appointment) {
    lines.push(`O ${label} foi agendado para ${formatDateTime(appointment.inicio)}.`);
    if (appointment.observacoes?.trim()) {
      lines.push(appointment.observacoes.trim());
    }
    lines.push("");
  }

  if (meeting && isRegisteredMeeting(meeting)) {
    lines.push(`Relato do ${label.toLowerCase()} (${formatDateTime(meeting.data_atendimento)}):`);
    lines.push("");
    lines.push(relatoBody(meeting));
    appendReferralsAndObs(lines, meeting);
    lines.push("");
  }

  return lines;
}

export function buildConsolidatedReportDraft(
  ctx: ConsolidatedReportContext,
  meetings: ConsolidatedReportMeeting[],
  appointments: RequestAppointment[],
): string {
  const registered = meetings.filter(isRegisteredMeeting);
  if (registered.length === 0 && appointments.length === 0) return "";

  const meetingByNumero = Object.fromEntries(meetings.map((m) => [m.numero, m]));
  const appointmentByNumero = Object.fromEntries(
    appointments.filter((a) => a.numero).map((a) => [a.numero!, a]),
  );

  const lines: string[] = [
    `Relatório circunstanciado — Protocolo ${ctx.protocolo}`,
    `Escola: ${ctx.escolaNome}`,
    `Aluno(a): ${ctx.alunoNome}`,
    "",
  ];

  for (const numero of MEETING_ORDER) {
    const appointment = appointmentByNumero[numero];
    const meeting = meetingByNumero[numero];
    if (!appointment && !meeting) continue;

    if (numero === "primeiro") {
      lines.push(...buildPrimeiroEncontroSection(appointment, meeting, ctx));
    } else {
      lines.push(...buildDemaisEncontrosSection(numero, appointment, meeting));
    }
  }

  return lines.join("\n").trim();
}
