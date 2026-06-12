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
  aguardando_aprovacao: "Aguardando Aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const requestStatusTone: Record<string, string> = {
  recebida: "bg-info/10 text-info border-info/20",
  distribuida: "bg-primary/10 text-primary border-primary/20",
  em_andamento: "bg-warning/15 text-warning-foreground border-warning/30",
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

export const meetingNumberLabels: Record<string, string> = {
  primeiro: "1º Encontro",
  segundo: "2º Encontro",
  terceiro: "3º Encontro",
};

export const meetingTypeLabels: Record<string, string> = {
  acolhimento: "Acolhimento",
  visita_tecnica: "Visita Técnica",
  reuniao: "Reunião",
  outros: "Outros",
};

export const reportStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  correcao_solicitada: "Correção Solicitada",
};

export const closureResultLabels: Record<string, string> = {
  resolvido: "Resolvido",
  encaminhado: "Encaminhado",
  em_acompanhamento: "Em Acompanhamento",
  nao_localizado: "Não Localizado",
};
