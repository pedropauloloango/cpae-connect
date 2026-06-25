// Centralized label maps for enum values used throughout the UI.

export const complaintTypeLabels: Record<string, string> = {
  ansiedade_depressao: "Ansiedade / Depressão",
  violacao_direitos: "Violação de Direitos",
  ideacao_suicida: "Ideação Suicida",
  bullying: "Bullying",
  conflito_familiar: "Conflito Familiar",
  outros: "Outros",
};

export const requestStatusLabels: Record<string, string> = {
  recebida: "Solicitação Recebida",
  distribuida: "Distribuída",
  em_andamento: "Em Andamento",
  em_ajuste: "Em Ajuste",
  aguardando_aprovacao: "Aguardando Aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function isRequestLockedForMeetingEdits(status: string | null | undefined): boolean {
  return status === "aguardando_aprovacao" || status === "concluida";
}

export const requestStatusTone: Record<string, string> = {
  recebida: "bg-info/10 text-info border-info/20",
  distribuida: "bg-primary/10 text-primary border-primary/20",
  em_andamento: "bg-warning/15 text-warning-foreground border-warning/30",
  em_ajuste: "bg-orange-500/10 text-orange-700 border-orange-500/25 dark:text-orange-400",
  aguardando_aprovacao: "bg-accent/10 text-accent border-accent/20",
  concluida: "bg-success/10 text-success border-success/20",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export const professionalStatusLabels: Record<string, string> = {
  ativo: "Ativo",
  ferias: "Férias",
  licenca: "Licença",
  inativo: "Inativo",
};

export const schoolTipoLabels: Record<string, string> = {
  escola: "Escola",
  emei: "EMEI",
};

export const meetingNumberLabels: Record<string, string> = {
  primeiro: "1º Encontro",
  segundo: "2º Encontro",
  terceiro: "3º Encontro",
  quarto: "4º Encontro",
  quinto: "5º Encontro",
};

export const meetingTypeLabels: Record<string, string> = {
  acolhimento: "Acolhimento",
  vivencia: "Vivência",
  palestra: "Palestra",
  visita_tecnica: "Visita Técnica",
  reuniao: "Reunião",
  outros: "Outros",
};

/** Tipos de visita disponíveis no agendamento escolar */
export const visitTypeOptions = [
  "acolhimento",
  "vivencia",
  "palestra",
  "visita_tecnica",
] as const;

export const schoolRepresentativeLabels: Record<string, string> = {
  diretor: "Diretor",
  adjunto: "Diretor Adjunto",
  coordenador_pedagogico: "Coordenador Pedagógico",
  secretario: "Secretário",
};

export const reportStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  registrado: "Encontro Registrado",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  correcao_solicitada: "Correção Solicitada",
};

export const reportStatusTone: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  registrado: "bg-info/10 text-info border-info/20",
  aguardando_aprovacao: "bg-accent/10 text-accent border-accent/20",
  aprovado: "bg-success/10 text-success border-success/20",
  rejeitado: "bg-destructive/10 text-destructive border-destructive/20",
  correcao_solicitada: "bg-warning/15 text-warning-foreground border-warning/30",
};

export const reportStatusCardTone: Record<string, string> = {
  rascunho: "border-l-muted-foreground/40",
  registrado: "border-l-info",
  aguardando_aprovacao: "border-l-accent",
  aprovado: "border-l-success",
  rejeitado: "border-l-destructive",
  correcao_solicitada: "border-l-warning",
};

export const closureResultLabels: Record<string, string> = {
  concluido: "Concluído",
  concluido_com_encaminhamento: "Concluído com encaminhamento",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encaminhado: "Encaminhado",
  em_acompanhamento: "Em Acompanhamento",
  nao_localizado: "Não Localizado",
};

/** Opções exibidas no formulário do relatório circunstanciado. */
export const closureResultSelectOptions = [
  { value: "concluido", label: "Concluído" },
  { value: "concluido_com_encaminhamento", label: "Concluído com encaminhamento" },
  { value: "em_andamento", label: "Em andamento" },
] as const;

export const accountStatusLabels: Record<string, string> = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const accountStatusTone: Record<string, string> = {
  pendente: "bg-warning/15 text-warning-foreground border-warning/30",
  aprovado: "bg-success/10 text-success border-success/20",
  rejeitado: "bg-destructive/10 text-destructive border-destructive/20",
};

export const appRoleLabels: Record<string, string> = {
  admin: "Administrador",
  profissional: "Profissional",
};
