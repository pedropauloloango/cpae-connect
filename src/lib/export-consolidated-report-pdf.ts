import type { ConsolidatedReportContext } from "@/lib/consolidated-report";

const PRINT_ROOT_ATTR = "data-cpae-print-export";
const PRINT_STYLE_ATTR = "data-cpae-print-style";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintMarkup(ctx: ConsolidatedReportContext, relatoTexto: string): string {
  const body = escapeHtml(relatoTexto).replace(/\n/g, "<br />");
  const emittedAt = new Date().toLocaleString("pt-BR");

  return `
    <div class="cpae-print-doc">
      <h1>Relatório Circunstanciado de Acolhimento</h1>
      <div class="cpae-print-meta">
        <p><strong>Protocolo:</strong> ${escapeHtml(ctx.protocolo)}</p>
        <p><strong>Escola:</strong> ${escapeHtml(ctx.escolaNome)}</p>
        <p><strong>Aluno(a):</strong> ${escapeHtml(ctx.alunoNome)}</p>
        <p><strong>Emitido em:</strong> ${emittedAt}</p>
      </div>
      <div class="cpae-print-content">${body}</div>
    </div>
  `;
}

function cleanupPrintArtifacts() {
  document.querySelectorAll(`[${PRINT_ROOT_ATTR}]`).forEach((el) => el.remove());
  document.querySelectorAll(`[${PRINT_STYLE_ATTR}]`).forEach((el) => el.remove());
}

export function exportConsolidatedReportPdf(
  ctx: ConsolidatedReportContext,
  relatoTexto: string,
): void {
  cleanupPrintArtifacts();

  const root = document.createElement("div");
  root.setAttribute(PRINT_ROOT_ATTR, "true");
  root.innerHTML = buildPrintMarkup(ctx, relatoTexto);

  const style = document.createElement("style");
  style.setAttribute(PRINT_STYLE_ATTR, "true");
  style.textContent = `
    [${PRINT_ROOT_ATTR}] {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 21cm;
      pointer-events: none;
    }
    [${PRINT_ROOT_ATTR}] .cpae-print-doc {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      padding: 0;
    }
    [${PRINT_ROOT_ATTR}] h1 {
      font-size: 16pt;
      margin: 0 0 0.5rem;
      font-weight: 700;
    }
    [${PRINT_ROOT_ATTR}] .cpae-print-meta {
      font-size: 11pt;
      color: #444;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.75rem;
    }
    [${PRINT_ROOT_ATTR}] .cpae-print-meta p { margin: 0.2rem 0; }
    [${PRINT_ROOT_ATTR}] .cpae-print-content { text-align: justify; }

    @media print {
      @page { margin: 2cm; }
      body * { visibility: hidden !important; }
      [${PRINT_ROOT_ATTR}],
      [${PRINT_ROOT_ATTR}] * {
        visibility: visible !important;
      }
      [${PRINT_ROOT_ATTR}] {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        pointer-events: auto !important;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);

  const cleanup = () => cleanupPrintArtifacts();

  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);

  window.print();
}
