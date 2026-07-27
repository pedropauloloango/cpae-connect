import { VISIT_SCHEDULE_DURATION_MS } from "@/lib/appointment-utils";

/** Valor `HH:MM` ou string vazia. */
export function parseHoraInicio(value: string | null | undefined): { hour: string; minute: string } {
  if (!value?.trim()) return { hour: "", minute: "" };
  const [hour = "", minute = ""] = value.trim().slice(0, 5).split(":");
  return { hour, minute: minute.padStart(2, "0").slice(0, 2) };
}

export function buildHoraInicio(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  return `${hour}:${minute}`;
}

/** Formata TIME/`HH:MM`/`HH:MM:SS` para exibição. */
export function formatHoraInicio(value: string | null | undefined): string {
  const { hour, minute } = parseHoraInicio(value);
  if (!hour || !minute) return "—";
  return `${hour}:${minute}`;
}

/**
 * Slot de agenda a partir de data + hora de início (duração fixa 1h).
 * Sem hora → evento de dia inteiro.
 */
export function vivenciaPreferredAgendaSlot(
  date: string,
  horaInicio: string | null | undefined,
): { start: string; end?: string; allDay: boolean } {
  const { hour, minute } = parseHoraInicio(horaInicio);
  if (!hour || !minute) {
    return { start: date, allDay: true };
  }
  const start = `${date}T${hour}:${minute}:00`;
  const startMs = new Date(start).getTime();
  const endDate = new Date(startMs + VISIT_SCHEDULE_DURATION_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = `${date}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
  return { start, end, allDay: false };
}
