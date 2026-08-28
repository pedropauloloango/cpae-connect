import { getRequestIP } from "@tanstack/react-start/server";

/** IP do cliente no contexto da requisição atual (Vercel/proxy com X-Forwarded-For). */
export function getClientIp(): string | null {
  try {
    const ip = getRequestIP({ xForwardedFor: true })?.trim();
    if (ip) return ip.slice(0, 45);
  } catch {
    /* fora de contexto de request */
  }
  return null;
}

/** Extrai o IP do cliente a partir dos headers comuns em proxies (Vercel, Cloudflare, etc.). */
export function getClientIpFromRequest(request: Request): string | null {
  const fromContext = getClientIp();
  if (fromContext) return fromContext;

  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp) {
    const first = vercelIp.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 45);

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp.slice(0, 45);

  return null;
}
