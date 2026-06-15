import { CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MeetingSummary = {
  status: string;
};

export function summarizeMeetings(meetings: MeetingSummary[] | null | undefined) {
  const list = meetings ?? [];
  return {
    total: list.length,
    registered: list.filter((m) => m.status === "registrado" || m.status === "aprovado").length,
  };
}

export function MeetingCountIndicators({ meetings }: { meetings: MeetingSummary[] | null | undefined }) {
  const { total, registered } = summarizeMeetings(meetings);

  if (total === 0) {
    return <span className="text-muted-foreground">0</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-medium tabular-nums">{total}</span>
          </TooltipTrigger>
          <TooltipContent>{total === 1 ? "1 encontro registrado" : `${total} encontros registrados`}</TooltipContent>
        </Tooltip>

        {registered > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-info/10 px-1.5 py-0.5 text-[11px] font-semibold text-info ring-1 ring-info/20">
                <CheckCircle2 className="h-3 w-3" />
                {registered}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {registered === 1 ? "1 encontro concluído" : `${registered} encontros concluídos`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
