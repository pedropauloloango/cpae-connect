export const SCHOOL_IMPORT_COLUMNS = [
  { key: "nome", label: "Nome", required: true },
  { key: "tipo_escola", label: "Tipo Escola", required: true },
  { key: "codigo_siger", label: "Código SIGER", required: false },
  { key: "codigo_inep", label: "Código INEP/MEC", required: false },
  { key: "endereco", label: "Endereço", required: false },
  { key: "bairro", label: "Bairro", required: false },
  { key: "cep", label: "CEP", required: false },
  { key: "regiao", label: "Região", required: false },
  { key: "tipologia", label: "Tipologia", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "ramal", label: "Ramal", required: false },
  { key: "diretor_nome", label: "Diretor(a)", required: false },
  { key: "diretor_celular", label: "Celular diretor(a)", required: false },
  { key: "diretor_cpf", label: "CPF/Matrícula diretor(a)", required: false },
] as const;

export type SchoolTipo = "escola" | "emei";

export type SchoolImportRow = {
  nome: string;
  tipo_escola: SchoolTipo;
  codigo_siger: string | null;
  codigo_inep: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
  tipologia: string | null;
  email: string | null;
  ramal: string | null;
  diretor_nome: string | null;
  diretor_celular: string | null;
  diretor_cpf: string | null;
};

export type SchoolImportPreview = {
  valid: SchoolImportRow[];
  errors: { line: number; message: string }[];
};

const HEADER_ALIASES: Record<string, keyof SchoolImportRow> = {
  nome: "nome",
  "nome da escola": "nome",
  "nome escola": "nome",
  "escola": "nome",
  tipo_escola: "tipo_escola",
  "tipo escola": "tipo_escola",
  "tipo da escola": "tipo_escola",
  codigo_siger: "codigo_siger",
  "codigo siger": "codigo_siger",
  siger: "codigo_siger",
  codigo_inep: "codigo_inep",
  "codigo inep": "codigo_inep",
  inep: "codigo_inep",
  "codigo inep/mec": "codigo_inep",
  endereco: "endereco",
  "endereço": "endereco",
  bairro: "bairro",
  cep: "cep",
  regiao: "regiao",
  "região": "regiao",
  tipologia: "tipologia",
  email: "email",
  "e-mail": "email",
  ramal: "ramal",
  diretor_nome: "diretor_nome",
  "diretor(a)": "diretor_nome",
  diretor: "diretor_nome",
  "nome diretor": "diretor_nome",
  diretor_celular: "diretor_celular",
  "celular diretor(a)": "diretor_celular",
  "celular diretor": "diretor_celular",
  diretor_cpf: "diretor_cpf",
  "cpf/matrícula": "diretor_cpf",
  "cpf matricula": "diretor_cpf",
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\*/g, "");
}

function detectDelimiter(line: string): ";" | "," {
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: ";" | ","): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function emptyToNull(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function mapHeaders(headers: string[]): (keyof SchoolImportRow | null)[] {
  return headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);
}

function parseTipoEscola(value: string | null | undefined): SchoolTipo | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (v === "emei") return "emei";
  if (v === "escola") return "escola";
  return null;
}

export function downloadSchoolImportTemplate() {
  const header = SCHOOL_IMPORT_COLUMNS.map((c) => `${c.label}${c.required ? " *" : ""}`).join(";");
  const example = [
    "EMEI Exemplo",
    "EMEI",
    "12345",
    "67890123",
    "Rua Exemplo, 100",
    "Centro",
    "79000-000",
    "Centro",
    "EMEI",
    "escola@exemplo.ms.gov.br",
    "1234",
    "Maria Silva",
    "(67) 99999-9999",
    "123.456.789-00",
  ].join(";");

  const csv = `\uFEFF${header}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-cadastro-escolas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseSchoolImportFile(file: File): Promise<SchoolImportPreview> {
  const text = await file.text();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return { valid: [], errors: [{ line: 1, message: "Planilha vazia ou sem linhas de dados." }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter);
  const mappedHeaders = mapHeaders(headerCells);

  if (!mappedHeaders.includes("nome")) {
    return {
      valid: [],
      errors: [{ line: 1, message: 'Coluna "Nome" não encontrada. Use o modelo fornecido.' }],
    };
  }

  const valid: SchoolImportRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = parseCsvLine(lines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;

    const row: Partial<SchoolImportRow> = {};
    mappedHeaders.forEach((key, idx) => {
      if (!key) return;
      row[key] = emptyToNull(cells[idx]) as never;
    });

    const nome = row.nome?.trim();
    if (!nome) {
      errors.push({ line: lineNumber, message: "Nome da escola é obrigatório." });
      continue;
    }

    const tipoRaw = row.tipo_escola;
    const tipo_escola = parseTipoEscola(typeof tipoRaw === "string" ? tipoRaw : null);
    if (!tipo_escola) {
      errors.push({ line: lineNumber, message: 'Tipo Escola inválido. Use "Escola" ou "EMEI".' });
      continue;
    }

    valid.push({
      nome,
      tipo_escola,
      codigo_siger: row.codigo_siger ?? null,
      codigo_inep: row.codigo_inep ?? null,
      endereco: row.endereco ?? null,
      bairro: row.bairro ?? null,
      cep: row.cep ?? null,
      regiao: row.regiao ?? null,
      tipologia: row.tipologia ?? null,
      email: row.email ?? null,
      ramal: row.ramal ?? null,
      diretor_nome: row.diretor_nome ?? null,
      diretor_celular: row.diretor_celular ?? null,
      diretor_cpf: row.diretor_cpf ?? null,
    });
  }

  return { valid, errors };
}

export function formValuesToSchoolRow(vals: Record<string, string>): SchoolImportRow {
  const tipo_escola = parseTipoEscola(vals.tipo_escola);
  if (!tipo_escola) {
    throw new Error('Tipo Escola inválido. Use "Escola" ou "EMEI".');
  }

  return {
    nome: vals.nome.trim(),
    tipo_escola,
    codigo_siger: emptyToNull(vals.codigo_siger),
    codigo_inep: emptyToNull(vals.codigo_inep),
    endereco: emptyToNull(vals.endereco),
    bairro: emptyToNull(vals.bairro),
    cep: emptyToNull(vals.cep),
    regiao: emptyToNull(vals.regiao),
    tipologia: emptyToNull(vals.tipologia),
    email: emptyToNull(vals.email),
    ramal: emptyToNull(vals.ramal),
    diretor_nome: emptyToNull(vals.diretor_nome),
    diretor_celular: emptyToNull(vals.diretor_celular),
    diretor_cpf: emptyToNull(vals.diretor_cpf),
  };
}
