/** Bloqueia edição/exclusão após o dia da realização (data de início). */
export function isVisitaTecnicaLocked(inicioIso: string, now = new Date()): boolean {
  const visit = new Date(inicioIso);
  if (Number.isNaN(visit.getTime())) return true;
  const visitDay = new Date(visit.getFullYear(), visit.getMonth(), visit.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today > visitDay;
}

export function buildVisitaTecnicaTitle(schoolNome: string): string {
  const nome = schoolNome.trim() || "Escola";
  return `Visita técnica — ${nome}`;
}
