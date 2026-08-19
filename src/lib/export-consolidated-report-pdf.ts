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

function escapeHtmlPreserveNewlines(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br />");
}

type EncounterKey = "primeiro" | "segundo" | "terceiro" | "quarto";

function splitRelatoByEncounter(relatoTexto: string): Record<EncounterKey, string> {
  // buildConsolidatedReportDraft monta:
  // 1) cabeçalho (4 linhas) -> "Relatório circunstanciado — Protocolo...", "Escola:", "Aluno(a):", ""
  // 2) blocos por encontro
  const rawLines = relatoTexto.split("\n");
  const firstEncounterIndex = rawLines.findIndex((line) => {
    const t = line.trim();
    return (
      /^No\s+dia\b/.test(t) ||
      /^O\s+2º\s+Encontro\b/.test(t) ||
      /^O\s+3º\s+Encontro\b/.test(t) ||
      /^O\s+4º\s+Encontro\b/.test(t) ||
      /^Relato\s+do\s+2º\s+encontro\b/.test(t) ||
      /^Relato\s+do\s+3º\s+encontro\b/.test(t) ||
      /^Relato\s+do\s+4º\s+encontro\b/.test(t)
    );
  });

  const contentLines =
    firstEncounterIndex >= 0 ? rawLines.slice(firstEncounterIndex) : rawLines.length >= 4 ? rawLines.slice(4) : rawLines;

  const sections: Record<EncounterKey, string[]> = {
    primeiro: [],
    segundo: [],
    terceiro: [],
    quarto: [],
  };

  const getEncounterByMarker = (line: string): EncounterKey | null => {
    // Segundo em diante pode aparecer como:
    // - "O 2º Encontro foi agendado para ..."
    // - "Relato do 2º encontro (...):"
    if (/^O\s+2º\s+Encontro\b/.test(line) || /^Relato\s+do\s+2º\s+encontro\b/.test(line)) return "segundo";
    if (/^O\s+3º\s+Encontro\b/.test(line) || /^Relato\s+do\s+3º\s+encontro\b/.test(line)) return "terceiro";
    if (/^O\s+4º\s+Encontro\b/.test(line) || /^Relato\s+do\s+4º\s+encontro\b/.test(line)) return "quarto";
    return null;
  };

  let current: EncounterKey = "primeiro";

  for (const line of contentLines) {
    const next = getEncounterByMarker(line.trim());
    if (next) current = next;
    sections[current].push(line);
  }

  return {
    primeiro: sections.primeiro.join("\n").trim(),
    segundo: sections.segundo.join("\n").trim(),
    terceiro: sections.terceiro.join("\n").trim(),
    quarto: sections.quarto.join("\n").trim(),
  };
}

function buildEncaminhamentosHtml(relatoTexto: string): string {
  const lines = relatoTexto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const relevant = lines.filter(
    (l) =>
      l.startsWith("Encaminhamentos indicados:") ||
      l.startsWith("Observações:"),
  );

  if (relevant.length === 0) {
    return escapeHtmlPreserveNewlines("Aparecer os encaminhamentos feitos pelo Técnico.");
  }

  return escapeHtmlPreserveNewlines(relevant.join("\n"));
}

function buildPrintMarkupForm(relatoCtx: ConsolidatedReportContext, relatoTexto: string): string {
  const emittedAt = new Date().toLocaleString("pt-BR");
  const sections = splitRelatoByEncounter(relatoTexto);

  const getOrPlaceholder = (value: string, placeholder: string) => (value ? value : placeholder);

  const placeholder = "(DESCRIÇÃO DO QUE O TÉCNICO ESCREVEU NO REGISTRO DO ENCONTRO.)";

  const primeiroHtml = escapeHtmlPreserveNewlines(getOrPlaceholder(
    sections.primeiro,
    `(DESCRIÇÃO DO QUE O TÉCNICO ESCREVEU NO REGISTRO DO 1º ENCONTRO.)`,
  ));
  const segundoHtml = escapeHtmlPreserveNewlines(getOrPlaceholder(
    sections.segundo,
    `(DESCRIÇÃO DO QUE O TÉCNICO ESCREVEU NO REGISTRO DO 2º ENCONTRO.)`,
  ));
  const terceiroHtml = escapeHtmlPreserveNewlines(getOrPlaceholder(
    sections.terceiro,
    `(DESCRIÇÃO DO QUE O TÉCNICO ESCREVEU NO REGISTRO DO 3º ENCONTRO.)`,
  ));
  const quartoHtml = escapeHtmlPreserveNewlines(getOrPlaceholder(
    sections.quarto,
    `(DESCRIÇÃO DO QUE O TÉCNICO ESCREVEU NO REGISTRO DO 4º ENCONTRO.)`,
  ));

  const encaminhamentosHtml = buildEncaminhamentosHtml(relatoTexto);

  return `
    <div class="cpae-print-page">
      <div class="cpae-print-top-logos">
        <div class="cpae-print-logo-left">
          <img src="/logo_SEMED.png" alt="SEMED" />
        </div>
        <div class="cpae-print-logo-right">
          <img src="/logo_CPAE.png" alt="CPAE" />
        </div>
      </div>

      <div class="cpae-print-fields">
        <div class="cpae-field-row">
          <span class="cpae-field-label">Protocolo:</span>
          <span class="cpae-field-value">${escapeHtml(relatoCtx.protocolo)}</span>
        </div>
        <div class="cpae-field-row">
          <span class="cpae-field-label">Escola:</span>
          <span class="cpae-field-value">${escapeHtml(relatoCtx.escolaNome)}</span>
        </div>
        <div class="cpae-field-row">
          <span class="cpae-field-label">Aluno(a):</span>
          <span class="cpae-field-value">${escapeHtml(relatoCtx.alunoNome)}</span>
        </div>
        <div class="cpae-field-row">
          <span class="cpae-field-label">Emitido em:</span>
          <span class="cpae-field-value">${escapeHtml(emittedAt)}</span>
        </div>
      </div>

      <div class="cpae-print-title">
        RELATÓRIO DE ACOLHIMENTO SOCIOEMOCIONAL
      </div>

      <div class="cpae-print-encounters">
        <div class="cpae-encounter">
          <div class="cpae-encounter-title">1º Acolhimento Socioemocional:</div>
          <div class="cpae-encounter-text">${primeiroHtml}</div>
        </div>
        <div class="cpae-encounter">
          <div class="cpae-encounter-title">2º Acolhimento Socioemocional:</div>
          <div class="cpae-encounter-text">${segundoHtml}</div>
        </div>
        <div class="cpae-encounter">
          <div class="cpae-encounter-title">3º Acolhimento Socioemocional:</div>
          <div class="cpae-encounter-text">${terceiroHtml}</div>
        </div>
        <div class="cpae-encounter">
          <div class="cpae-encounter-title">4º Acolhimento Socioemocional:</div>
          <div class="cpae-encounter-text">${quartoHtml}</div>
        </div>
      </div>

      <div class="cpae-print-referrals">
        <div class="cpae-print-referrals-title">ENCAMINHAMENTOS:</div>
        <div class="cpae-print-referrals-text">${encaminhamentosHtml}</div>
        <div class="cpae-signature">
          <span>Assinatura Digital:</span>
          <span class="cpae-signature-line"></span>
        </div>
      </div>
    </div>
  `;
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
  // Mantemos o fallback antigo (buildPrintMarkup), mas a versão atual é o "modelo de formulário"
  // para ficar visualmente igual ao template do sistema.
  root.innerHTML = buildPrintMarkupForm(ctx, relatoTexto) || buildPrintMarkup(ctx, relatoTexto);

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
    [${PRINT_ROOT_ATTR}] .cpae-print-doc,
    [${PRINT_ROOT_ATTR}] .cpae-print-page {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-page {
      width: 100%;
      border: 1px solid #111;
      padding: 24px 24px 20px;
      box-sizing: border-box;
      background: #fff;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-top-logos {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-print-top-logos img {
      height: 50px;
      width: auto;
      object-fit: contain;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-fields {
      margin-bottom: 18px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-field-row {
      display: flex;
      gap: 8px;
      margin: 6px 0;
      white-space: nowrap;
    }
    [${PRINT_ROOT_ATTR}] .cpae-field-label {
      min-width: 96px;
      font-weight: 700;
    }
    [${PRINT_ROOT_ATTR}] .cpae-field-value {
      flex: 1;
      border-bottom: 1px solid #999;
      padding-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-title {
      text-align: center;
      font-weight: 800;
      font-size: 15pt;
      margin: 16px 0 22px;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-encounters {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 18px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-encounter-title {
      font-weight: 700;
      margin-bottom: 6px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-encounter-text {
      padding: 10px 0 0;
      min-height: 72px;
      overflow: hidden;
    }

    [${PRINT_ROOT_ATTR}] .cpae-print-referrals-title {
      font-weight: 800;
      margin-bottom: 8px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-print-referrals-text {
      min-height: 70px;
      white-space: normal;
    }

    [${PRINT_ROOT_ATTR}] .cpae-signature {
      margin-top: 22px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    [${PRINT_ROOT_ATTR}] .cpae-signature-line {
      flex: 1;
      border-bottom: 1px solid #999;
    }

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
