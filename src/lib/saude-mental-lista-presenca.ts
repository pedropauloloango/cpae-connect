/** Exporta lista de presença (impressão na mesma aba) com coluna de assinatura. */

export type PresencaListaRow = {
  nome_completo: string;
  cpf: string | null;
  escola: string | null;
  presente: boolean;
};

export type PresencaListaMeta = {
  modulo_curso: string;
  data: string;
  horario: string;
  local: string;
  ano_curso: number;
};

const PRINT_ROOT_ATTR = "data-cpae-sm-presenca-print";
const PRINT_STYLE_ATTR = "data-cpae-sm-presenca-print-style";

const SM_COLORS = {
  blue: "#0F52BA",
  blueDark: "#083D8C",
  purple: "#7B2CBF",
  orange: "#FF8C00",
} as const;

function printAssetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

async function loadPrintImageDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Falha ao ler imagem"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDataBr(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function formatHorario(value: string): string {
  return String(value).slice(0, 5);
}

function cleanupPrintArtifacts() {
  document.querySelectorAll(`[${PRINT_ROOT_ATTR}]`).forEach((el) => el.remove());
  document.querySelectorAll(`[${PRINT_STYLE_ATTR}]`).forEach((el) => el.remove());
}

export async function exportListaPresencaPrint(
  meta: PresencaListaMeta,
  rows: PresencaListaRow[],
): Promise<void> {
  cleanupPrintArtifacts();

  const sorted = [...rows].sort((a, b) =>
    a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
  );

  const bodyRows = sorted
    .map(
      (r, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(r.nome_completo)}</td>
        <td>${escapeHtml(r.escola?.trim() || "—")}</td>
        <td class="assinatura"></td>
      </tr>`,
    )
    .join("");

  const style = document.createElement("style");
  style.setAttribute(PRINT_STYLE_ATTR, "true");
  style.textContent = `
    [${PRINT_ROOT_ATTR}] {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 210mm;
      pointer-events: none;
    }

    @media print {
      @page { size: A4 portrait; margin: 12mm; }

      body * { visibility: hidden !important; }
      [${PRINT_ROOT_ATTR}],
      [${PRINT_ROOT_ATTR}] * {
        visibility: visible !important;
      }
      [${PRINT_ROOT_ATTR}] {
        display: block !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        background: #fff !important;
        color: #0f172a !important;
        font-family: "Segoe UI", Arial, sans-serif !important;
        font-size: 11px !important;
      }
      [${PRINT_ROOT_ATTR}] .hero {
        position: relative;
        overflow: hidden;
        margin: 0 0 14px;
        padding: 14px 16px;
        border-radius: 12px;
        background: linear-gradient(135deg, #fff 0%, rgba(237, 233, 254, 0.45) 50%, rgba(219, 234, 254, 0.55) 100%);
        border: 1px solid #e2e8f0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [${PRINT_ROOT_ATTR}] .hero-grid {
        display: grid;
        grid-template-columns: 120px 1fr 130px;
        gap: 12px;
        align-items: center;
      }
      [${PRINT_ROOT_ATTR}] .hero-logo {
        min-width: 120px;
      }
      [${PRINT_ROOT_ATTR}] .hero-logo img {
        display: block !important;
        width: 120px;
        max-width: 120px;
        height: auto;
        object-fit: contain;
        visibility: visible !important;
      }
      [${PRINT_ROOT_ATTR}] img {
        visibility: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [${PRINT_ROOT_ATTR}] .hero-center {
        text-align: center;
      }
      [${PRINT_ROOT_ATTR}] .hero-badge {
        display: inline-block;
        margin: 0 0 6px;
        padding: 3px 10px;
        border-radius: 999px;
        background: ${SM_COLORS.purple};
        color: #fff;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      [${PRINT_ROOT_ATTR}] .hero-title {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      [${PRINT_ROOT_ATTR}] .hero-title .line1 { color: ${SM_COLORS.blue}; }
      [${PRINT_ROOT_ATTR}] .hero-title .line2 { color: ${SM_COLORS.blueDark}; }
      [${PRINT_ROOT_ATTR}] .hero-tagline {
        margin: 6px 0 0;
        font-size: 9px;
        font-weight: 500;
        color: #334155;
        line-height: 1.35;
      }
      [${PRINT_ROOT_ATTR}] .hero-tagline .blue { color: ${SM_COLORS.blue}; font-weight: 700; }
      [${PRINT_ROOT_ATTR}] .hero-tagline .purple { color: ${SM_COLORS.purple}; font-weight: 700; }
      [${PRINT_ROOT_ATTR}] .hero-tagline .orange { color: ${SM_COLORS.orange}; font-weight: 700; }
      [${PRINT_ROOT_ATTR}] .hero-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      [${PRINT_ROOT_ATTR}] .hero-semed {
        display: block;
        height: 36px;
        width: auto;
      }
      [${PRINT_ROOT_ATTR}] .hero-quote {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        max-width: 130px;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #ede9fe;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }
      [${PRINT_ROOT_ATTR}] .hero-quote svg {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        color: ${SM_COLORS.purple};
      }
      [${PRINT_ROOT_ATTR}] .hero-quote p {
        margin: 0;
        font-size: 7.5px;
        font-weight: 600;
        line-height: 1.35;
        color: #334155;
      }
      [${PRINT_ROOT_ATTR}] .lista-bar {
        margin: 0 0 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [${PRINT_ROOT_ATTR}] .lista-bar h2 {
        margin: 0 0 3px;
        font-size: 13px;
        font-weight: 800;
        color: ${SM_COLORS.blueDark};
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      [${PRINT_ROOT_ATTR}] .lista-bar .meta {
        margin: 0;
        color: #475569;
        font-size: 10px;
        line-height: 1.4;
      }
      [${PRINT_ROOT_ATTR}] .lista-bar .meta strong {
        color: ${SM_COLORS.purple};
      }
      [${PRINT_ROOT_ATTR}] table {
        width: 100%;
        border-collapse: collapse;
      }
      [${PRINT_ROOT_ATTR}] th,
      [${PRINT_ROOT_ATTR}] td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        vertical-align: middle;
      }
      [${PRINT_ROOT_ATTR}] th {
        background: #f1f5f9 !important;
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [${PRINT_ROOT_ATTR}] .num {
        width: 28px;
        text-align: center;
        color: #64748b;
      }
      [${PRINT_ROOT_ATTR}] .assinatura {
        height: 28px;
        min-width: 160px;
        width: 28%;
      }
      [${PRINT_ROOT_ATTR}] tbody tr {
        page-break-inside: avoid;
        break-inside: avoid-page;
      }
      [${PRINT_ROOT_ATTR}] .footer-area {
        margin-top: 18mm;
        padding-bottom: 8mm;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }
      [${PRINT_ROOT_ATTR}] .footer {
        display: flex;
        justify-content: space-between;
        gap: 24px;
      }
      [${PRINT_ROOT_ATTR}] .sign-box {
        flex: 1;
        min-height: 22mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }
      [${PRINT_ROOT_ATTR}] .sign-line {
        border-top: 1px solid #94a3b8;
        padding-top: 6px;
        text-align: center;
        color: #64748b;
        font-size: 10px;
      }
    }
  `;

  const root = document.createElement("div");
  root.setAttribute(PRINT_ROOT_ATTR, "true");

  const [brainLogo, semedLogo] = await Promise.all([
    loadPrintImageDataUrl(printAssetUrl("/landing/saude-mental-brain-logo.jpg")),
    loadPrintImageDataUrl(printAssetUrl("/logo_SEMED.png")),
  ]);

  root.innerHTML = `
    <header class="hero">
      <div class="hero-grid">
        <div class="hero-logo">
          <img src="${brainLogo}" alt="Curso de Saúde Mental na Educação" />
        </div>
        <div class="hero-center">
          <span class="hero-badge">Curso de Capacitação</span>
          <h1 class="hero-title">
            <span class="line1">Saúde Mental</span><br />
            <span class="line2">na Educação</span>
          </h1>
          <p class="hero-tagline">
            Uma escola que
            <span class="blue"> acolhe</span>,
            <span class="purple"> escuta</span> e
            <span class="orange"> cuida</span>
            transforma vidas!
          </p>
        </div>
        <div class="hero-right">
          <img class="hero-semed" src="${semedLogo}" alt="SEMED Campo Grande" />
          <div class="hero-quote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p>Cuidar de quem educa também é cuidar de quem aprende.</p>
          </div>
        </div>
      </div>
    </header>
    <div class="lista-bar">
      <h2>Lista de presença</h2>
      <p class="meta">
        <strong>${escapeHtml(meta.modulo_curso)}</strong> · ${escapeHtml(formatDataBr(meta.data))} ·
        ${escapeHtml(formatHorario(meta.horario))} · ${escapeHtml(meta.local)} · Ano ${meta.ano_curso}
      </p>
    </div>
    <table>
      <thead>
        <tr>
          <th class="num">Nº</th>
          <th>Nome</th>
          <th>Escola / EMEI</th>
          <th>Assinatura</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
    <div class="footer-area">
      <div class="footer">
        <div class="sign-box">
          <div class="sign-line">Responsável / Facilitador</div>
        </div>
        <div class="sign-box">
          <div class="sign-line">Data / carimbo</div>
        </div>
      </div>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);

  await waitForImages(root);

  const cleanup = () => cleanupPrintArtifacts();
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);

  window.print();
}
