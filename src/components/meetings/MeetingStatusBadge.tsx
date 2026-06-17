import { Badge } from "@/components/ui/badge";
import { reportStatusLabels, reportStatusTone } from "@/lib/labels";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Edit3,
  FilePenLine,
  Inbox,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const reportStatusIcons: Record<string, LucideIcon> = {
  rascunho: FilePenLine,
  registrado: CheckCircle2,
  aguardando_aprovacao: Clock,
  aprovado: CheckCircle2,
  rejeitado: XCircle,
  correcao_solicitada: Edit3,
};

export { reportStatusIcons };

export function MeetingStatusBadge({ status, className }: { status: string; className?: string }) {
  const Icon = reportStatusIcons[status] ?? Inbox;
  const label = reportStatusLabels[status] ?? status;
  const tone = reportStatusTone[status] ?? reportStatusTone.rascunho;

  return (
    <Badge variant="outline" className={`gap-1.5 font-normal ${tone} ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Badge>
  );
}

export function AppointmentScheduledBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-normal bg-primary/10 text-primary border-primary/20 ${className ?? ""}`}
    >
      <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
      Agendado
    </Badge>
  );
}
