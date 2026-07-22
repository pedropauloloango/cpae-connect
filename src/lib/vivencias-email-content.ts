import {
  periodoLabels,
  regiaoEscolaLabel,
  solicitanteCargoLabels,
} from "@/lib/acolhimento-options";
import { schoolTipoLabels } from "@/lib/labels";
import { palestraTemaLabel, vivenciaTemaLabel } from "@/lib/vivencias-options";

export type VivenciaEmailGroup = {
  aluno_serie: string;
  aluno_turma: string;
  periodo: string;
  temas: string[];
  data_preferivel?: string | null;
};

export type VivenciaEmailPayload = {
  requestId: string;
  numero: string;
  school_nome: string;
  tipo_escola: string;
  regiao_escola: string | null;
  solicitante_email: string;
  solicitante_nome: string;
  solicitante_cargo: string;
  solicitante_telefone: string;
  groups: VivenciaEmailGroup[];
  palestra_tema?: string | null;
  data_preferivel_palestra?: string | null;
  /** E-mails com alerta Vivências ativos (vindos do RPC de submit). */
  alertEmails?: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function buildDetailRows(data: VivenciaEmailPayload): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Protocolo", value: data.numero },
    {
      label: "Escola / EMEI",
      value: `${data.school_nome} (${schoolTipoLabels[data.tipo_escola] ?? data.tipo_escola})`,
    },
    { label: "Região", value: regiaoEscolaLabel(data.regiao_escola ?? "") },
    { label: "Solicitante", value: data.solicitante_nome },
    {
      label: "Cargo",
      value: solicitanteCargoLabels[data.solicitante_cargo] ?? data.solicitante_cargo,
    },
    { label: "E-mail do solicitante", value: data.solicitante_email },
    { label: "Telefone", value: data.solicitante_telefone },
    { label: "Turmas solicitadas", value: String(data.groups.length) },
  ];

  data.groups.forEach((g, index) => {
    const n = index + 1;
    const temas = g.temas.map((t) => vivenciaTemaLabel(t)).join("; ") || "—";
    rows.push({
      label: `Turma ${n}`,
      value: `${g.aluno_serie} — turma ${g.aluno_turma} · ${periodoLabels[g.periodo] ?? g.periodo} · ${temas} · data ${formatDate(g.data_preferivel)}`,
    });
  });

  if (data.palestra_tema) {
    rows.push({ label: "Palestra", value: palestraTemaLabel(data.palestra_tema) });
    rows.push({ label: "Data preferível (palestra)", value: formatDate(data.data_preferivel_palestra) });
  }

  return rows;
}

function renderRowsHtml(rows: Array<{ label: string; value: string }>): string {
  return rows
    .map(
      (row) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
}

function renderRowsText(rows: Array<{ label: string; value: string }>): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join("\n");
}

function emailShell(
  title: string,
  intro: string,
  rows: Array<{ label: string; value: string }>,
  footer?: string,
): { html: string; text: string } {
  const footerHtml = footer
    ? `<p style="margin:24px 0 0;font-size:13px;color:#64748b;">${escapeHtml(footer)}</p>`
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h1 style="font-size:20px;margin:0 0 12px;color:#15803d;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;line-height:1.5;color:#334155;">${escapeHtml(intro)}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        ${renderRowsHtml(rows)}
      </table>
      ${footerHtml}
    </div>
  `.trim();

  const text = `${title}\n\n${intro}\n\n${renderRowsText(rows)}${footer ? `\n\n${footer}` : ""}`;

  return { html, text };
}

export function buildAdminVivenciaEmail(data: VivenciaEmailPayload, appUrl: string) {
  const rows = buildDetailRows(data);
  const demandaUrl = appUrl ? `${appUrl}/modulo-vivencias/demandas/${data.requestId}` : "";
  const footer = demandaUrl
    ? `Acesse a demanda no sistema: ${demandaUrl}`
    : "Acesse o módulo Vivências no sistema de gestão CPAE para visualizar e atribuir a solicitação.";

  return emailShell(
    "Nova solicitação de vivências / palestras",
    `Uma nova solicitação foi registrada pelo formulário público. Protocolo ${data.numero}.`,
    rows,
    footer,
  );
}

export function buildSolicitanteVivenciaEmail(data: VivenciaEmailPayload) {
  const rows = buildDetailRows(data);

  return emailShell(
    "Solicitação de vivências registrada",
    `Olá, ${data.solicitante_nome}. Sua solicitação foi recebida pela CPAE. Guarde o protocolo abaixo para acompanhamento.`,
    rows,
    "A equipe da CPAE analisará o pedido e entrará em contato conforme necessário.",
  );
}
