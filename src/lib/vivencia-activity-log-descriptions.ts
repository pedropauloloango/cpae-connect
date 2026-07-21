import { solicitanteCargoLabels } from "@/lib/acolhimento-options";
import { palestraTemaLabel } from "@/lib/vivencias-options";

export type VivenciaActivityLogRow = {
  id: string;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
};

export type VivenciaActivityLogContext = {
  request?: {
    numero?: string;
    solicitante_nome?: string | null;
    solicitante_cargo?: string | null;
  } | null;
  professionalNames: Record<string, string>;
  actorNames: Record<string, string>;
};

function professionalName(id: unknown, ctx: VivenciaActivityLogContext): string {
  if (typeof id !== "string" || !id) return "profissional não identificado";
  return ctx.professionalNames[id] ?? "profissional não identificado";
}

function professionalNamesList(ids: unknown, ctx: VivenciaActivityLogContext): string {
  if (!Array.isArray(ids) || ids.length === 0) return "profissional não identificado";
  return ids.map((id) => professionalName(id, ctx)).join(", ");
}

function actorName(log: VivenciaActivityLogRow, ctx: VivenciaActivityLogContext): string | null {
  if (log.actor_id && ctx.actorNames[log.actor_id]) return ctx.actorNames[log.actor_id];
  if (log.actor_label && log.actor_label !== "Sistema") return log.actor_label;
  return null;
}

function solicitanteFromRequest(ctx: VivenciaActivityLogContext): { nome: string; cargo: string } {
  const req = ctx.request;
  if (!req) return { nome: "—", cargo: "—" };
  const nome = req.solicitante_nome ?? "—";
  const cargo = req.solicitante_cargo
    ? (solicitanteCargoLabels[req.solicitante_cargo] ?? req.solicitante_cargo)
    : "—";
  return { nome, cargo };
}

export function formatVivenciaActivityLogDescription(
  log: VivenciaActivityLogRow,
  ctx: VivenciaActivityLogContext,
): string {
  const details = log.details ?? {};
  const actor = actorName(log, ctx);
  const actorSuffix = actor ? ` Ação registrada por ${actor}.` : "";

  switch (log.action) {
    case "solicitacao_criada": {
      const { nome, cargo } = solicitanteFromRequest(ctx);
      const numero = String(details.numero ?? ctx.request?.numero ?? "—");
      const groupsCount = typeof details.groups_count === "number" ? details.groups_count : null;
      const palestra = details.palestra_tema ? palestraTemaLabel(String(details.palestra_tema)) : null;
      let text = `Quem criou: ${nome}, cargo ${cargo}. Protocolo ${numero}.`;
      if (groupsCount !== null && groupsCount > 0) {
        text += ` ${groupsCount} grupo(s) de vivência informado(s).`;
      }
      if (palestra && palestra !== "—") text += ` Palestra: ${palestra}.`;
      return text;
    }
    case "atribuicao": {
      const names = professionalNamesList(details.professional_ids, ctx);
      if (typeof details.professional_id === "string") {
        return `Atribuída a ${professionalName(details.professional_id, ctx)}.${actorSuffix}`;
      }
      return `Atribuída a ${names}.${actorSuffix}`;
    }
    case "atribuicao_desfeita":
      return `Atribuição de ${professionalName(details.previous_professional_id, ctx)} foi removida.${actorSuffix}`;
    case "demanda_editada":
      return `Demanda editada pelo administrador.${actorSuffix}`;
    case "relatorio_salvo":
      return `Relatório de vivências escolares salvo como rascunho.${actorSuffix}`;
    case "relatorio_enviado_aprovacao":
      return `Relatório de vivências escolares enviado para validação.${actorSuffix}`;
    case "aprovacao_relatorio_aprovado":
      return `Relatório de vivências escolares aprovado.${actorSuffix}`;
    case "aprovacao_relatorio_rejeitado":
      return `Relatório de vivências escolares rejeitado.${details.comentario ? ` Motivo: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    case "aprovacao_relatorio_correcao_solicitada":
      return `Correção solicitada no relatório de vivências escolares.${details.comentario ? ` Observação: ${String(details.comentario)}.` : ""}${actorSuffix}`;
    default:
      return log.action.replace(/_/g, " ") + (actorSuffix || ".");
  }
}

export function vivenciaActivityLogTitle(action: string): string {
  return (
    {
      solicitacao_criada: "Solicitação criada",
      atribuicao: "Profissional(is) atribuído(s)",
      atribuicao_desfeita: "Atribuição removida",
      demanda_editada: "Demanda editada",
      relatorio_salvo: "Relatório salvo",
      relatorio_enviado_aprovacao: "Relatório enviado para validação",
      aprovacao_relatorio_aprovado: "Relatório aprovado",
      aprovacao_relatorio_rejeitado: "Relatório rejeitado",
      aprovacao_relatorio_correcao_solicitada: "Correção solicitada no relatório",
    } as Record<string, string>
  )[action] ?? action.replace(/_/g, " ");
}

export function collectVivenciaActivityLogLookupIds(logs: VivenciaActivityLogRow[]): {
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
    if (Array.isArray(d.professional_ids)) {
      for (const id of d.professional_ids) {
        if (typeof id === "string") professionalIds.add(id);
      }
    }
  }

  return {
    professionalIds: [...professionalIds],
    actorIds: [...actorIds],
  };
}
