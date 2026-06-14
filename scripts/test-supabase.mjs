/**
 * Testa conexão Supabase usando variáveis do .env (sem imprimir chaves).
 * Uso: node scripts/test-supabase.mjs
 * Em redes corporativas com proxy SSL: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/test-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Rede corporativa pode exigir isso para fetch Node.js (PowerShell Invoke-WebRequest já conecta)
if (process.env.SUPABASE_TEST_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const m = l.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
      return m ? [m[1], m[2]] : [];
    })
    .filter((e) => e.length === 2),
);

function normalizeUrl(url) {
  if (!url) return url;
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function decodeJwtRole(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    return payload.role ?? "unknown";
  } catch {
    return "invalid";
  }
}

async function probe(name, baseUrl, key) {
  if (!baseUrl || !key) return { name, ok: false, error: "variável ausente" };

  try {
    const authRes = await fetch(`${baseUrl}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    });
    const restRes = await fetch(`${baseUrl}/rest/v1/schools?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const restBody = restRes.ok ? "" : (await restRes.text()).slice(0, 120);

    return {
      name,
      ok: authRes.ok && restRes.ok,
      auth: { status: authRes.status, ok: authRes.ok },
      rest: { status: restRes.status, ok: restRes.ok, hint: restBody },
      keyRole: key.startsWith("eyJ") ? decodeJwtRole(key) : "publishable-format",
    };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

const urlFromEnv = env.SUPABASE_URL;
const urlFixed = normalizeUrl(urlFromEnv);
const urlMismatch = urlFromEnv !== urlFixed;

console.log("=== Teste de conexão Supabase ===\n");
console.log("URL no .env:", urlFromEnv || "(vazio)");
if (urlMismatch) {
  console.log("URL corrigida (sem /rest/v1):", urlFixed);
  console.log("⚠ SUPABASE_URL não deve incluir /rest/v1\n");
}

const tests = [
  ["SUPABASE_PUBLISHABLE_KEY + URL .env", urlFromEnv, env.SUPABASE_PUBLISHABLE_KEY],
  ["SUPABASE_PUBLISHABLE_KEY + URL corrigida", urlFixed, env.SUPABASE_PUBLISHABLE_KEY],
  ["VITE_SUPABASE_PUBLISHABLE_KEY + URL corrigida", urlFixed, env.VITE_SUPABASE_PUBLISHABLE_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY + URL corrigida", urlFixed, env.SUPABASE_SERVICE_ROLE_KEY],
];

const results = [];
for (const [name, url, key] of tests) {
  results.push(await probe(name, normalizeUrl(url), key));
}

for (const r of results) {
  const icon = r.ok ? "OK" : "FALHOU";
  console.log(`[${icon}] ${r.name}`);
  if (r.error) console.log(`       erro: ${r.error}`);
  else {
    console.log(`       auth: ${r.auth.status} | rest: ${r.rest.status} | key role: ${r.keyRole}`);
    if (r.rest.hint) console.log(`       rest hint: ${r.rest.hint}`);
  }
}

const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceRole?.startsWith("eyJ") && decodeJwtRole(serviceRole) !== "service_role") {
  console.log("\n⚠ SUPABASE_SERVICE_ROLE_KEY parece ser chave anon, não service_role.");
  console.log("  Copie a service_role key em: Supabase Dashboard → Project Settings → API");
}

const anyOk = results.some((r) => r.ok);
console.log(anyOk ? "\n✓ Pelo menos uma combinação funcionou." : "\n✗ Nenhuma combinação conectou. Revise URL e chaves no .env.");
process.exit(anyOk ? 0 : 1);
