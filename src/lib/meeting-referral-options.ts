export const meetingReferralOptions = [
  { value: "ubs_ubsf", label: "UBS/UBSF" },
  { value: "clinica_escola_psicologia", label: "Clínica Escola de Psicologia" },
  { value: "caps_ij", label: "CAPS-IJ" },
  { value: "rede_privada", label: "Rede Privada" },
] as const;

export type MeetingReferralOption = (typeof meetingReferralOptions)[number]["value"];

export const meetingReferralLabels: Record<MeetingReferralOption, string> = Object.fromEntries(
  meetingReferralOptions.map((o) => [o.value, o.label]),
) as Record<MeetingReferralOption, string>;

export function normalizeMeetingReferralOptions(values: unknown): MeetingReferralOption[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(meetingReferralOptions.map((o) => o.value));
  return values.filter((v): v is MeetingReferralOption => typeof v === "string" && allowed.has(v as MeetingReferralOption));
}

export function formatMeetingReferralOptions(values: unknown): string {
  return normalizeMeetingReferralOptions(values)
    .map((v) => meetingReferralLabels[v])
    .join(", ");
}
