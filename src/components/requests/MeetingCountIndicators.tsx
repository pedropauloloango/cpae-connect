import { Bell, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MeetingSummary = {
  status: string;
};

export function summarizeMeetings(meetings: MeetingSummary[] | null | undefined) {
  const list = meetings ?? [];
  return {
    total: list.length,
    pendingApproval: list.filter((m) => m.status === "aguardando_aprovacao").length,
    approved: list.filter((m) => m.status === "aprovado").length,
  };
}

export function MeetingPendingApprovalBadge({ meetings }: { meetings: MeetingSummary[] | null | undefined }) {
  const { pendingApproval } = summarizeMeetings(meetings);
  if (pendingApproval === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-orange-600 ring-1 ring-warning/30 dark:text-orange-400">
      <Bell className="h-3 w-3" />
      {pendingApproval}
    </span>
  );
}

export function MeetingCountIndicators({ meetings }: { meetings: MeetingSummary[] | null | undefined }) {
  const { total, pendingApproval, approved } = summarizeMeetings(meetings);

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

        {pendingApproval > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-orange-600 ring-1 ring-warning/30 dark:text-orange-400">
                <Bell className="h-3 w-3" />
                {pendingApproval}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {pendingApproval === 1 ? "1 encontro aguardando aprovação" : `${pendingApproval} encontros aguardando aprovação`}
            </TooltipContent>
          </Tooltip>
        )}

        {approved > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
                <CheckCircle2 className="h-3 w-3" />
                {approved}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {approved === 1 ? "1 encontro aprovado" : `${approved} encontros aprovados`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
