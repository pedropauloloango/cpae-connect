import { complaintTypeLabels, closureResultLabels, meetingNumberLabels, meetingTypeLabels } from "@/lib/labels";
import { situacaoObservadaLabels, solicitanteCargoLabels } from "@/lib/acolhimento-options";

export type ActivityLogRow = {
  id: string;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
};

export type ActivityLogContext = {
  request?: {
    numero?: string;
    solicitante_nome?: string | null;
    solicitante_cargo?: string | null;
    solicitante_nome_cargo?: string | null;
  } | null;
  professionalNames: Record<string, string>;
  actorNames: Record<string, string>;
};

function professionalName(id: unknown, ctx: ActivityLogContext): string {
  if (typeof id !== "string" || !id) return "profissional não identificado";
  return ctx.professionalNames[id] ?? "profissional não identificado";
}

function actorName(log: ActivityLogRow, ctx: ActivityLogContext): string | null {
  if (log.actor_id && ctx.actorNames[log.actor_id]) return ctx.actorNames[log.actor_id];
  if (log.actor_label && log.actor_label !== "Sistema") return log.actor_label;
  return null;
}

function solicitanteFromRequest(ctx: ActivityLogContext): { nome: string; cargo: string } {
  const req = ctx.request;
  if (!req) return { nome: "—", cargo: "—" };
  const nome =
    req.solicitante_nome ??
    req.solicitante_nome_cargo?.split(" — ")[0]?.trim() ??
    "—";
  let cargo = "—";
  if (req.solicitante_cargo) {
    cargo = solicitanteCargoLabels[req.solicitante_cargo] ?? req.solicitante_cargo;
  } else if (req.solicitante_nome_cargo?.includes(" — ")) {
    cargo = req.solicitante_nome_cargo.split(" — ").slice(1).join(" — ").trim();
  }
  return { nome, cargo };
}

function formatSituacoes(details: Record<string, unknown> | null): string | null {
  const raw = details?.situacao_observada;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((s) => situacaoObservadaLabels[String(s)] ?? String(s)).join(", ");
}

export function formatActivityLogDescription(log: ActivityLogRow, ctx: ActivityLogContext): string {
  const details = log.details ?? {};
  const actor = actorName(log, ctx);
  const actorSuffix = actor ? ` Ação registrada por ${actor}.` : "";

  switch (log.action) {
    case "solicitacao_criada": {
      const { nome, cargo } = solicitanteFromRequest(ctx);
      const numero = String(details.numero ?? ctx.request?.numero ?? "—");
      const situacoes = formatSituacoes(details);
      let text = `Criada por ${nome}, cargo ${cargo}. Protocolo ${numero}.`;
      if (situacoes) text += ` Situações observadas: ${situacoes}.`;
      return text;
    }
    case "atribuicao":
      return `Solicitação encaminhada para o profissional ${professionalName(details.professional_id, ctx)}.${actorSuffix}`;
    case "atribuicao_desfeita":
      return `Atribuição ao profissional ${professionalName(details.previous_professional_id, ctx)} foi desfeita. A solicitação voltou ao status recebida.${actorSuffix}`;
    case "encontro_registrado": {
      const numero = String(details.numero ?? "");
      const label = (meetingNumberLabels[numero] ?? numero) || "encontro";
      return `${label} registrado.${actorSuffix}`;
    }
    case "encontro_atualizado":
      return `Relato do encontro atualizado.${actorSuffix}`;
    case "relatorio_consolidado_salvo":
      return `Relatório circunstanciado salvo.${details.com_anexo ? " Com anexo." : ""}${actorSuffix}`;
    case "relatorio_enviado_aprovacao":
      return `Relatório circunstanciado enviado para aprovação.${actorSuffix}`;
    case "aprovacao_relatorio_aprovado":
      return `Relatório circunstanciado aprovado.${details.comentario ? ` Comentário: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "aprovacao_relatorio_rejeitado":
      return `Relatório circunstanciado rejeitado.${details.comentario ? ` Motivo: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "aprovacao_relatorio_correcao_solicitada":
      return `Correção solicitada no relatório circunstanciado.${details.comentario ? ` Observação: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "visita_agendada_editada": {
      const numero = String(details.numero ?? "");
      const label = (meetingNumberLabels[numero] ?? numero) || "encontro";
      const tipo = details.tipo ? meetingTypeLabels[String(details.tipo)] ?? String(details.tipo) : null;
      const inicio = details.inicio ? new Date(String(details.inicio)).toLocaleString("pt-BR") : null;
      const representante = details.representante_nome ? String(details.representante_nome) : null;
      let text = `Agendamento da visita (${label}) foi atualizado.`;
      if (representante) text += ` Contato: ${representante}.`;
      if (tipo) text += ` Tipo: ${tipo}.`;
      if (inicio) text += ` Data/hora: ${inicio}.`;
      return text + actorSuffix;
    }
    case "visita_agendada": {
      const numero = String(details.numero ?? "");
      const label = (meetingNumberLabels[numero] ?? numero) || "encontro";
      const tipo = details.tipo ? meetingTypeLabels[String(details.tipo)] ?? String(details.tipo) : null;
      const inicio = details.inicio ? new Date(String(details.inicio)).toLocaleString("pt-BR") : null;
      const representante = details.representante_nome ? String(details.representante_nome) : null;
      let text = `Visita agendada para ${label}.`;
      if (representante) text += ` Contato: ${representante}.`;
      if (tipo) text += ` Tipo: ${tipo}.`;
      if (inicio) text += ` Data/hora: ${inicio}.`;
      return text + actorSuffix;
    }
    case "encontro_enviado_aprovacao":
      return `Encontro enviado para aprovação.${actorSuffix}`;
    case "encontro_corrigido":
      return `Relato corrigido após solicitação de correção.${actorSuffix}`;
    case "aprovacao_aprovado":
      return `Relato aprovado.${details.comentario ? ` Comentário: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "aprovacao_rejeitado":
      return `Relato rejeitado.${details.comentario ? ` Motivo: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "aprovacao_correcao_solicitada":
      return `Correção solicitada no relato.${details.comentario ? ` Observação: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "caso_encerrado": {
      const classificacao = details.classificacao_final
        ? complaintTypeLabels[String(details.classificacao_final)] ?? String(details.classificacao_final)
        : null;
      const resultado = details.resultado
        ? closureResultLabels[String(details.resultado)] ?? String(details.resultado)
        : null;
      const parts = ["Caso encerrado."];
      if (classificacao) parts.push(`Queixa final: ${classificacao}.`);
      if (resultado) parts.push(`Resultado: ${resultado}.`);
      return parts.join(" ") + actorSuffix;
    }
    default:
      return log.action.replace(/_/g, " ") + (actorSuffix || ".");
  }
}

export function collectActivityLogLookupIds(logs: ActivityLogRow[]): {
  professionalIds: string[];
  actorIds: string[];
} {
  const professionalIds = new Set<string>();
  const actorIds = new Set<string>();

  for (const log of logs) {
    if (log.actor_id) actorIds.add(log.actor_id);
    const d = log.details;
    if (!d) continue;
    if (typeof d.professional_id === "string") professionalIds.add(d.professional_id);
    if (typeof d.previous_professional_id === "string") professionalIds.add(d.previous_professional_id);
  }

  return {
    professionalIds: [...professionalIds],
    actorIds: [...actorIds],
  };
}

export function activityLogTitle(action: string): string {
  return (
    {
      solicitacao_criada: "Solicitação criada",
      atribuicao: "Profissional atribuído",
      atribuicao_desfeita: "Atribuição desfeita",
      encontro_registrado: "Encontro registrado",
      encontro_atualizado: "Encontro atualizado",
      relatorio_consolidado_salvo: "Relatório circunstanciado salvo",
      relatorio_enviado_aprovacao: "Relatório enviado para aprovação",
      aprovacao_relatorio_aprovado: "Relatório aprovado",
      aprovacao_relatorio_rejeitado: "Relatório rejeitado",
      aprovacao_relatorio_correcao_solicitada: "Correção solicitada no relatório",
      visita_agendada: "Visita agendada",
      visita_agendada_editada: "Agendamento editado",
      encontro_enviado_aprovacao: "Encontro enviado para aprovação",
      encontro_corrigido: "Relato corrigido",
      aprovacao_aprovado: "Relato aprovado",
      aprovacao_rejeitado: "Relato rejeitado",
      aprovacao_correcao_solicitada: "Correção solicitada",
      caso_encerrado: "Caso encerrado",
    } as Record<string, string>
  )[action] ?? action.replace(/_/g, " ");
}
