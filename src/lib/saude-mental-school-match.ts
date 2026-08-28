/** Normalização e match de nomes de escola (import / vínculo). */

export function normalizeSchoolNameForMatch(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(escola municipal|escola de educacao infantil|escola|emei|e m|em|e\.m\.?|municipal|professora?|prof)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export type SchoolMatchCandidate = {
  id: string;
  nome: string;
};

/**
 * Tenta vincular o texto livre da planilha a uma escola cadastrada.
 * Retorna null se ambíguo ou sem match confiável.
 */
export function matchSchoolByText(
  raw: string | null | undefined,
  schools: SchoolMatchCandidate[],
): SchoolMatchCandidate | null {
  const needle = normalizeSchoolNameForMatch(raw);
  if (!needle || needle.length < 3) return null;

  const scored = schools
    .map((s) => {
      const hay = normalizeSchoolNameForMatch(s.nome);
      if (!hay) return { s, score: 0 };
      if (hay === needle) return { s, score: 100 };
      if (hay.includes(needle) || needle.includes(hay)) {
        const ratio = Math.min(hay.length, needle.length) / Math.max(hay.length, needle.length);
        return { s, score: Math.round(70 + ratio * 25) };
      }
      // tokens: exige maioria das palavras significativas (>=3 chars)
      const tokens = needle.split(" ").filter((t) => t.length >= 3);
      if (tokens.length === 0) return { s, score: 0 };
      const hits = tokens.filter((t) => hay.includes(t)).length;
      const ratio = hits / tokens.length;
      if (ratio >= 0.8 && hits >= 2) return { s, score: Math.round(50 + ratio * 30) };
      return { s, score: 0 };
    })
    .filter((x) => x.score >= 70)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  // Ambíguo se top 2 muito próximos
  if (scored.length > 1 && scored[0].score - scored[1].score < 8 && scored[1].score >= 70) {
    return null;
  }
  return scored[0].s;
}
