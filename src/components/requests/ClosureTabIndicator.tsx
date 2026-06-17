import { reportStatusLabels } from "@/lib/labels";
import { reportStatusIcons } from "@/components/meetings/MeetingStatusBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilePenLine, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const tabTone: Record<string, string> = {
  rascunho: "bg-muted/80 text-muted-foreground ring-muted-foreground/25",
  aguardando_aprovacao: "bg-accent/10 text-accent ring-accent/25",
  aprovado: "bg-success/10 text-success ring-success/25",
  rejeitado: "bg-destructive/10 text-destructive ring-destructive/25",
  correcao_solicitada: "bg-warning/15 text-orange-600 ring-warning/30 dark:text-orange-400",
  pendente: "bg-primary/10 text-primary ring-primary/20",
};

export type ClosureTabIndicatorProps = {
  closure: { status: string } | null | undefined;
  registeredMeetingsCount?: number;
};

export function ClosureTabIndicator({ closure, registeredMeetingsCount = 0 }: ClosureTabIndicatorProps) {
  const status = closure?.status;

  if (!status) {
    if (registeredMeetingsCount === 0) return null;

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1",
                tabTone.pendente,
              )}
            >
              <FilePenLine className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Elaborar relatório consolidado</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const Icon = reportStatusIcons[status] ?? Inbox;
  const label = reportStatusLabels[status] ?? status;
  const tone = tabTone[status] ?? tabTone.rascunho;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1",
              tone,
            )}
          >
            <Icon className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
