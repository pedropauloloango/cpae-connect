import {
  autorizacaoAtaLabels,
  comunicouAbusoLabels,
  modalidadeLabels,
  periodoLabels,
  regiaoEscolaLabel,
  situacaoObservadaLabels,
  solicitanteCargoLabels,
  alunoSexoLabels,
} from "@/lib/acolhimento-options";
import { complaintTypeLabels, schoolTipoLabels } from "@/lib/labels";

export type AcolhimentoEmailPayload = {
  requestId: string;
  numero: string;
  school_nome: string;
  tipo_escola: string;
  regiao_escola: string | null;
  solicitante_email: string;
  solicitante_nome: string;
  solicitante_cargo: string;
  solicitante_telefone: string;
  modalidade_acolhimento: string;
  aluno_nome: string;
  aluno_nascimento: string;
  aluno_sexo: string;
  educacao_especial: boolean;
  aluno_serie: string;
  aluno_turma: string;
  aluno_turma_ano: string;
  periodo: string;
  comunicou_abuso: string[];
  situacao_observada: string[];
  acolhido_anteriormente: boolean;
  autorizacao_ata: string;
  tipo_queixa: string;
  /** E-mails com alerta Acolhimento ativos (vindos do RPC de submit). */
  alertEmails?: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function yesNo(value: boolean): string {
  return value ? "Sim" : "Não";
}

function labelList(values: string[], labels: Record<string, string>): string {
  if (!values.length) return "—";
  return values.map((v) => labels[v] ?? v).join("; ");
}

function buildDetailRows(data: AcolhimentoEmailPayload): Array<{ label: string; value: string }> {
  return [
    { label: "Protocolo", value: data.numero },
    { label: "Escola / EMEI", value: `${data.school_nome} (${schoolTipoLabels[data.tipo_escola] ?? data.tipo_escola})` },
    { label: "Região", value: regiaoEscolaLabel(data.regiao_escola ?? "") },
    { label: "Solicitante", value: data.solicitante_nome },
    { label: "Cargo", value: solicitanteCargoLabels[data.solicitante_cargo] ?? data.solicitante_cargo },
    { label: "E-mail do solicitante", value: data.solicitante_email },
    { label: "Telefone", value: data.solicitante_telefone },
    { label: "Modalidade", value: modalidadeLabels[data.modalidade_acolhimento] ?? data.modalidade_acolhimento },
    { label: "Aluno(a)", value: data.aluno_nome },
    { label: "Nascimento", value: formatDate(data.aluno_nascimento) },
    { label: "Sexo", value: alunoSexoLabels[data.aluno_sexo] ?? data.aluno_sexo },
    { label: "Educação especial", value: yesNo(data.educacao_especial) },
    { label: "Série / turma", value: `${data.aluno_serie} — turma ${data.aluno_turma}` },
    { label: "Período", value: periodoLabels[data.periodo] ?? data.periodo },
    { label: "Situação observada", value: labelList(data.situacao_observada, situacaoObservadaLabels) },
    { label: "Tipo de queixa (derivado)", value: complaintTypeLabels[data.tipo_queixa] ?? data.tipo_queixa },
    { label: "Comunicou abuso", value: labelList(data.comunicou_abuso, comunicouAbusoLabels) },
    { label: "Acolhido anteriormente", value: yesNo(data.acolhido_anteriormente) },
    { label: "Autorização em ata", value: autorizacaoAtaLabels[data.autorizacao_ata] ?? data.autorizacao_ata },
  ];
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

function emailShell(title: string, intro: string, rows: Array<{ label: string; value: string }>, footer?: string): { html: string; text: string } {
  const footerHtml = footer
    ? `<p style="margin:24px 0 0;font-size:13px;color:#64748b;">${escapeHtml(footer)}</p>`
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h1 style="font-size:20px;margin:0 0 12px;color:#0f52ba;">${escapeHtml(title)}</h1>
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

export function buildAdminAcolhimentoEmail(data: AcolhimentoEmailPayload, appUrl: string) {
  const rows = buildDetailRows(data);
  const demandaUrl = appUrl ? `${appUrl}/demandas/${data.requestId}` : "";
  const footer = demandaUrl
    ? `Acesse a demanda no sistema: ${demandaUrl}`
    : "Acesse o sistema de gestão CPAE para visualizar e atribuir a solicitação.";

  return emailShell(
    "Nova solicitação de acolhimento",
    `Uma nova solicitação foi registrada pelo formulário público. Protocolo ${data.numero}.`,
    rows,
    footer,
  );
}

export function buildSolicitanteAcolhimentoEmail(data: AcolhimentoEmailPayload) {
  const rows = buildDetailRows(data);

  return emailShell(
    "Solicitação de acolhimento registrada",
    `Olá, ${data.solicitante_nome}. Sua solicitação foi recebida pela CPAE. Guarde o protocolo abaixo para acompanhamento.`,
    rows,
    "A equipe da CPAE analisará o pedido e entrará em contato conforme necessário.",
  );
}
