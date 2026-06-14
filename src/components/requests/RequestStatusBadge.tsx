import { Badge } from "@/components/ui/badge";
import { requestStatusLabels, requestStatusTone } from "@/lib/labels";
import {
  CheckCircle2,
  Clock,
  Inbox,
  PlayCircle,
  Share2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const requestStatusIcons: Record<string, LucideIcon> = {
  recebida: Inbox,
  distribuida: Share2,
  em_andamento: PlayCircle,
  aguardando_aprovacao: Clock,
  concluida: CheckCircle2,
  cancelada: XCircle,
};

export function RequestStatusBadge({ status, className }: { status: string; className?: string }) {
  const Icon = requestStatusIcons[status] ?? Inbox;
  const label = requestStatusLabels[status] ?? status;
  const tone = requestStatusTone[status] ?? requestStatusTone.recebida;

  return (
    <Badge variant="outline" className={`gap-1.5 font-normal ${tone} ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Badge>
  );
}
