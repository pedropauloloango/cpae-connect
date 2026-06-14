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

export type VisitScheduleFormValues = {
  representante_nome: string;
  representante_cargo: string;
  tipo: string;
  inicio: string;
  fim: string;
  observacoes: string;
};

export const emptyVisitScheduleFormValues = (): VisitScheduleFormValues => ({
  representante_nome: "",
  representante_cargo: "diretor",
  tipo: "acolhimento",
  inicio: "",
  fim: "",
  observacoes: "",
});

export function mergeVisitScheduleDefaults(
  defaults?: Partial<VisitScheduleFormValues>,
): VisitScheduleFormValues {
  return {
    ...emptyVisitScheduleFormValues(),
    ...defaults,
  };
}

export function prepareAppointmentDatetimes(values: VisitScheduleFormValues): {
  inicio: string;
  fim: string;
} {
  const inicio = datetimeLocalToIso(values.inicio);
  const fim = datetimeLocalToIso(values.fim);
  if (new Date(fim) <= new Date(inicio)) {
    throw new Error("O término deve ser posterior ao início.");
  }
  return { inicio, fim };
}
