/** Assinatura discreta no rodapé dos e-mails transacionais. */
export function buildEmailSignatureHtml(appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  const logoUrl = base
    ? `${base}/email/daleal-assinatura.png`
    : "";

  if (!logoUrl) {
    return `
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:11px;line-height:1.4;color:#94a3b8;">
          DALEAL Tecnologia — Transformando ideias em soluções inteligentes.
        </p>
      </div>
    `.trim();
  }

  return `
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
      <img
        src="${logoUrl}"
        alt="DALEAL Tecnologia"
        width="140"
        style="display:inline-block;width:140px;max-width:40%;height:auto;opacity:0.92;border:0;outline:none;text-decoration:none;"
      />
    </div>
  `.trim();
}

export function buildEmailSignatureText(): string {
  return "\n\n—\nDALEAL Tecnologia — Transformando ideias em soluções inteligentes.";
}
