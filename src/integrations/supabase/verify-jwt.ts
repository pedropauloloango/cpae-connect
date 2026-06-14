import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";

export type SupabaseJwtPayload = {
  sub: string;
  exp?: number;
  role?: string;
  ref?: string;
  email?: string;
};

function decodeBase64Url(part: string): Buffer {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function parsePayload(payloadB64: string): SupabaseJwtPayload {
  const payload = JSON.parse(decodeBase64Url(payloadB64).toString("utf8")) as SupabaseJwtPayload;
  if (!payload.sub) {
    throw new Error("JWT missing sub claim");
  }
  if (payload.exp != null && payload.exp * 1000 < Date.now()) {
    throw new Error("JWT expired");
  }
  return payload;
}

function getJwtHeader(token: string): { alg?: string; kid?: string } {
  const headerB64 = token.split(".")[0];
  if (!headerB64) throw new Error("Invalid JWT format");
  return JSON.parse(decodeBase64Url(headerB64).toString("utf8")) as { alg?: string; kid?: string };
}

function getJwtAlg(token: string): string {
  return getJwtHeader(token).alg ?? "HS256";
}

type JwkLike = Record<string, unknown> & { alg?: string; kid?: string };

/** Aceita JWK único, JWKS `{ keys: [...] }` ou PEM. */
function resolvePublicKeyMaterial(publicKey: string, token: string): string | JwkLike {
  const trimmed = publicKey.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed;
  }

  const parsed = JSON.parse(trimmed) as JwkLike | { keys?: JwkLike[] };
  const keys = "keys" in parsed && Array.isArray(parsed.keys) ? parsed.keys : null;
  if (!keys?.length) {
    return parsed as JwkLike;
  }

  const header = getJwtHeader(token);
  if (header.kid) {
    const byKid = keys.find((k) => k.kid === header.kid);
    if (byKid) return byKid;
  }

  const byAlg = keys.find((k) => k.alg === header.alg || k.alg === "ES256");
  return byAlg ?? keys[0];
}

/** Valida JWT Supabase HS256 (Legacy JWT Secret). */
export function verifySupabaseAccessTokenHs256(token: string, jwtSecret: string): SupabaseJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = createHmac("sha256", jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();

  const actualSig = decodeBase64Url(signatureB64);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    throw new Error("Invalid JWT signature");
  }

  return parsePayload(payloadB64);
}

/** Valida JWT Supabase ES256 (JWT Signing Keys ECC). Aceita PEM ou JWK JSON. */
export function verifySupabaseAccessTokenEs256(token: string, publicKey: string): SupabaseJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = decodeBase64Url(signatureB64);

  const trimmed = publicKey.trim();
  const material = resolvePublicKeyMaterial(trimmed, token);
  const key =
    typeof material === "string"
      ? createPublicKey(material)
      : createPublicKey({ key: material, format: "jwk" });

  const valid = verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  if (!valid) throw new Error("Invalid JWT signature");

  return parsePayload(payloadB64);
}

/** Detecta HS256 ou ES256 e valida localmente (sem fetch externo). */
export function verifySupabaseAccessToken(
  token: string,
  opts: { jwtSecret?: string; jwtPublicKey?: string },
): SupabaseJwtPayload {
  const alg = getJwtAlg(token);

  if (alg === "HS256") {
    if (!opts.jwtSecret?.trim()) {
      throw new Error("Token HS256: configure SUPABASE_JWT_SECRET (aba Legacy JWT Secret)");
    }
    return verifySupabaseAccessTokenHs256(token, opts.jwtSecret);
  }

  if (alg === "ES256") {
    if (!opts.jwtPublicKey?.trim()) {
      throw new Error("Token ES256: configure SUPABASE_JWT_PUBLIC_KEY (aba JWT Signing Keys)");
    }
    return verifySupabaseAccessTokenEs256(token, opts.jwtPublicKey);
  }

  throw new Error(`Unsupported JWT algorithm: ${alg}`);
}

export function getProjectRefFromSupabaseUrl(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}
