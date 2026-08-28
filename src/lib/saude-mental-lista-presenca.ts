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

export function exportListaPresencaPrint(
  meta: PresencaListaMeta,
  rows: PresencaListaRow[],
): void {
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
      display: none;
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
        background: #fff !important;
        color: #0f172a !important;
        font-family: "Segoe UI", Arial, sans-serif !important;
        font-size: 11px !important;
      }
      [${PRINT_ROOT_ATTR}] h1 {
        font-size: 16px;
        margin: 0 0 4px;
      }
      [${PRINT_ROOT_ATTR}] .sub {
        color: #475569;
        margin: 0 0 12px;
        line-height: 1.4;
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
      [${PRINT_ROOT_ATTR}] .footer {
        margin-top: 18px;
        display: flex;
        justify-content: space-between;
        gap: 24px;
      }
      [${PRINT_ROOT_ATTR}] .sign-box {
        flex: 1;
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
  root.innerHTML = `
    <h1>Lista de presença — Curso de Saúde Mental na Educação</h1>
    <p class="sub">
      <strong>${escapeHtml(meta.modulo_curso)}</strong> · ${escapeHtml(formatDataBr(meta.data))} ·
      ${escapeHtml(formatHorario(meta.horario))} · ${escapeHtml(meta.local)} · Ano ${meta.ano_curso}
    </p>
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
    <div class="footer">
      <div class="sign-box">Responsável / Facilitador</div>
      <div class="sign-box">Data / carimbo</div>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);

  const cleanup = () => cleanupPrintArtifacts();
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);

  window.print();
}
