/** Horários permitidos no agendamento de visitas (07h–21h) */
export const VISIT_SCHEDULE_HOURS = Array.from({ length: 15 }, (_, i) =>
  String(7 + i).padStart(2, "0"),
);
export const VISIT_SCHEDULE_MINUTES = ["00", "15", "30", "45"] as const;
export const VISIT_SCHEDULE_DURATION_MS = 60 * 60 * 1000;

export type VisitScheduleDateTimeParts = {
  date: string;
  hour: string;
  minute: string;
};

/** Converte ISO datetime para valor de input datetime-local */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte datetime-local (hora local do navegador) para ISO UTC no banco */
export function datetimeLocalToIso(local: string): string {
  if (!local) throw new Error("Informe data e hora.");
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Data/hora inválida.");
  return d.toISOString();
}

export function parseDatetimeLocal(value: string): VisitScheduleDateTimeParts {
  if (!value) return { date: "", hour: "", minute: "" };
  if (!value.includes("T")) {
    return { date: value, hour: "", minute: "" };
  }
  const [date, time = ""] = value.split("T");
  const [hour = "", minute = ""] = time.split(":");
  return { date: date ?? "", hour, minute: minute.slice(0, 2) };
}

export function buildDatetimeLocal(parts: VisitScheduleDateTimeParts): string {
  if (!parts.date) return "";
  if (!parts.hour) return parts.date;
  if (!parts.minute) return `${parts.date}T${parts.hour}`;
  return `${parts.date}T${parts.hour}:${parts.minute}`;
}

function snapHour(hour: number): string {
  const clamped = Math.min(21, Math.max(7, Number.isNaN(hour) ? 7 : hour));
  return String(clamped).padStart(2, "0");
}

function snapMinute(minute: number): string {
  const allowed = VISIT_SCHEDULE_MINUTES.map(Number);
  const safe = Number.isNaN(minute) ? 0 : minute;
  const closest = allowed.reduce((prev, curr) =>
    Math.abs(curr - safe) < Math.abs(prev - safe) ? curr : prev,
  );
  return String(closest).padStart(2, "0");
}

/** Ajusta data/hora ao intervalo permitido no agendamento de visitas. */
export function normalizeVisitScheduleDatetime(value: string): string {
  if (!value) return "";
  const parts = parseDatetimeLocal(value);
  if (!parts.date) return value;
  if (!parts.hour || !parts.minute) return buildDatetimeLocal(parts);
  const hour = snapHour(Number(parts.hour));
  const minute = snapMinute(Number(parts.minute));
  return buildDatetimeLocal({ date: parts.date, hour, minute });
}

function assertCompleteDatetime(value: string, fieldLabel: string): void {
  const parts = parseDatetimeLocal(value);
  if (!parts.date || !parts.hour || !parts.minute) {
    throw new Error(`Informe data, hora e minutos de ${fieldLabel}.`);
  }
}

export type VisitScheduleFormValues = {
  representante_nome: string;
  representante_cargo: string;
  tipo: string;
  inicio: string;
  observacoes: string;
};

export const emptyVisitScheduleFormValues = (): VisitScheduleFormValues => ({
  representante_nome: "",
  representante_cargo: "diretor",
  tipo: "acolhimento",
  inicio: "",
  observacoes: "",
});

export function mergeVisitScheduleDefaults(
  defaults?: Partial<VisitScheduleFormValues>,
): VisitScheduleFormValues {
  const merged = {
    ...emptyVisitScheduleFormValues(),
    ...defaults,
  };
  return {
    ...merged,
    inicio: normalizeVisitScheduleDatetime(merged.inicio),
  };
}

export function prepareAppointmentDatetimes(values: Pick<VisitScheduleFormValues, "inicio">): {
  inicio: string;
  fim: string;
} {
  assertCompleteDatetime(values.inicio, "início");
  const inicio = datetimeLocalToIso(values.inicio);
  const fim = new Date(new Date(inicio).getTime() + VISIT_SCHEDULE_DURATION_MS).toISOString();
  return { inicio, fim };
}
