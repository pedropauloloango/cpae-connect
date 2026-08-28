/**
 * Importa inscritos do Excel do Curso de Saúde Mental na Educação.
 *
 * Uso:
 *   npx tsx scripts/import-saude-mental-inscritos.mts "C:\caminho\inscritos.xlsx"
 *
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env
 * Aplique antes: scripts/fix-saude-mental-module.sql
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { matchSchoolByText } from "../src/lib/saude-mental-school-match.ts";
import { digitsOnly, normalizeNivelEscolaridade } from "../src/lib/saude-mental-options.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function excelSerialToDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
    return epoch.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // m/d/yy or d/m/yy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let month = Number(m[1]);
    let day = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    // Datas US no arquivo (mês/dia/ano) — planilha Google Forms
    if (month > 12) {
      const tmp = month;
      month = day;
      day = tmp;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function excelStampToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const days = Math.floor(value);
    const frac = value - days;
    epoch.setUTCDate(epoch.getUTCDate() + days);
    epoch.setUTCMilliseconds(Math.round(frac * 86400000));
    return epoch.toISOString();
  }
  const s = String(value).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function col(row: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (key != null && row[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  // partial contains
  for (const name of names) {
    const key = Object.keys(row).find((k) => k.toLowerCase().includes(name.toLowerCase()));
    if (key != null && row[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return "";
}

async function main() {
  loadEnv();
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: npx tsx scripts/import-saude-mental-inscritos.mts "caminho/arquivo.xlsx"');
    process.exit(1);
  }
  const abs = resolve(file);
  if (!existsSync(abs)) {
    console.error("Arquivo não encontrado:", abs);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: schools, error: schoolsErr } = await supabase
    .from("schools")
    .select("id, nome")
    .is("deleted_at", null);
  if (schoolsErr) throw schoolsErr;

  const wb = XLSX.readFile(abs);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  let ok = 0;
  let linked = 0;
  let pendingSchool = 0;
  let failed = 0;

  for (const row of rows) {
    const nome = col(row, "NOME COMPLETO:", "NOME COMPLETO", "nome");
    if (!nome) continue;

    const escolaTexto = col(row, "EMEI/ESCOLA EM QUE ATUA:", "EMEI/ESCOLA EM QUE ATUA", "escola");
    const matched = matchSchoolByText(escolaTexto, schools ?? []);

    const payload = {
      nome_completo: nome,
      cpf: digitsOnly(col(row, "CPF:", "CPF")) || null,
      data_nascimento: excelSerialToDate(row["DATA DE NASCIMENTO"] ?? row["Data de nascimento"]),
      telefone_whatsapp: col(row, "TELEFONE (WHATSAPP):", "TELEFONE (WHATSAPP)", "telefone") || null,
      email: col(row, "EMAIL:", "EMAIL", "E-mail") || null,
      email_formulario: col(row, "Endereço de e-mail", "endereço de e-mail") || null,
      escola_texto: escolaTexto || null,
      school_id: matched?.id ?? null,
      school_nome: matched?.nome ?? null,
      funcao: col(row, "FUNÇÃO:", "FUNÇÃO", "funcao") || null,
      nivel_escolaridade:
        normalizeNivelEscolaridade(col(row, "NÍVEL DE ESCOLARIDADE:", "NÍVEL DE ESCOLARIDADE", "escolaridade")) ||
        null,
      inscrito_em: excelStampToIso(row["Carimbo de data/hora"] ?? row["Carimbo de data/hora "]),
      origem: "importacao",
      ano_curso: 2026,
    };

    const { error } = await supabase.rpc("submit_saude_mental_inscricao", { payload });
    if (error) {
      failed += 1;
      console.error("Falha:", nome, error.message);
      continue;
    }
    ok += 1;
    if (matched) linked += 1;
    else pendingSchool += 1;
  }

  console.log(
    JSON.stringify(
      { totalLinhas: rows.length, importados: ok, comEscola: linked, semVinculo: pendingSchool, falhas: failed },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
