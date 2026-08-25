/** Higienização dos campos de endereço das escolas (prefixos duplicados no cadastro). */

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Extrai só o CEP (8 dígitos), removendo prefixos como "CEP:". */
export function sanitizeCep(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    // tenta achar 8 dígitos no meio do texto
    const m = value.match(/\d{5}\D?\d{3}/);
    if (!m) return null;
    const d = m[0].replace(/\D/g, "");
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function sanitizeCepDigits(value: string | null | undefined): string {
  return (sanitizeCep(value) ?? "").replace(/\D/g, "");
}

/** Remove prefixo "Bairro" / "BAIRRO:" do valor. */
export function sanitizeBairro(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let v = collapseSpaces(value);
  v = v.replace(/^(bairro|bairo)\s*[:\-]?\s*/i, "");
  return v || null;
}

/** Remove prefixo "Endereço:" mas mantém Rua/Av/Travessa no valor. */
export function sanitizeEndereco(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let v = collapseSpaces(value);
  v = v.replace(/^(endere[cç]o|end\.?)\s*[:\-]?\s*/i, "");
  // "Rua Rua X" → "Rua X"
  v = v.replace(/^(rua|r\.)\s+\1\s+/i, "$1 ");
  v = v.replace(/^(avenida|av\.?)\s+\1\s+/i, "$1 ");
  return v || null;
}

export function sanitizeRegiao(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let v = collapseSpaces(value);
  v = v.replace(/^(regi[aã]o)\s*[:\-]?\s*/i, "");
  return v || null;
}

export function sanitizeNomeEscola(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return collapseSpaces(value) || null;
}

export type SanitizedSchoolAddress = {
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
  nome: string | null;
};

export function sanitizeSchoolAddressFields(input: {
  nome?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cep?: string | null;
  regiao?: string | null;
}): SanitizedSchoolAddress {
  return {
    nome: sanitizeNomeEscola(input.nome ?? null),
    endereco: sanitizeEndereco(input.endereco ?? null),
    bairro: sanitizeBairro(input.bairro ?? null),
    cep: sanitizeCep(input.cep ?? null),
    regiao: sanitizeRegiao(input.regiao ?? null),
  };
}
