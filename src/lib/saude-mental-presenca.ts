import { supabase } from "@/integrations/supabase/client";

export type EncontroQrInfo = {
  id: string;
  data: string;
  horario: string;
  local: string;
  modulo_curso: string;
  ano_curso: number;
  qr_ativo: boolean;
  qr_expires_at: string | null;
  recebimento_aberto: boolean;
};

export type ConfirmPresencaResult = {
  ok: boolean;
  mensagem: string;
  nome_completo: string | null;
  ja_registrado: boolean;
};

export type EncontroQrState = {
  qr_ativo: boolean;
  qr_expires_at: string | null;
};

/** Recebimento liberado agora (ativo e dentro da janela). */
export function isRecebimentoPresencaAtivo(row: EncontroQrState): boolean {
  if (!row.qr_ativo || !row.qr_expires_at) return false;
  return new Date(row.qr_expires_at).getTime() > Date.now();
}

export function formatRemainingMs(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function mapError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
    return "Função de presença não configurada. Execute o SQL de encontros/presença no Supabase.";
  }
  return msg || "Não foi possível processar a presença.";
}

export async function getEncontroByQrToken(token: string): Promise<EncontroQrInfo | null> {
  const { data, error } = await supabase.rpc("get_saude_mental_encontro_qr", {
    p_token: token,
  });
  if (error) throw new Error(mapError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return row as EncontroQrInfo;
}

export async function confirmarPresencaPorQr(
  token: string,
  cpf: string,
): Promise<ConfirmPresencaResult> {
  const { confirmarPresencaSaudeMentalQr } = await import("@/lib/saude-mental-presenca.functions");
  return confirmarPresencaSaudeMentalQr({ data: { token, cpf } });
}

/** Origem pública do app (QR Codes). Evita gerar link localhost ao testar no celular. */
export function getPublicAppOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_APP_URL ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function buildPresencaQrUrl(
  token: string,
  origin = getPublicAppOrigin(),
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/saude-mental/presenca/${token}`;
}

export function isQrUsingLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function buildPresencaQrFilename(meta: {
  modulo_curso: string;
  data: string;
  qr_token: string;
}): string {
  const modulo = meta.modulo_curso
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const tokenShort = meta.qr_token.slice(0, 8);
  return `qr-presenca-${modulo}-${meta.data}-${tokenShort}.png`;
}

/** Converte o SVG do QR (react-qr-code) em PNG e dispara o download. */
export async function downloadQrCodePng(
  svgEl: SVGSVGElement,
  filename: string,
  size = 512,
): Promise<void> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Falha ao carregar o QR Code."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não disponível.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error("Falha ao gerar PNG."));
          return;
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
