import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CollapsibleRecordCardProps = {
  title: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
};

export function CollapsibleRecordCard({
  title,
  headerActions,
  children,
  className,
  headerClassName,
  defaultOpen = false,
  forceOpen = false,
}: CollapsibleRecordCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <Card className={className}>
      <CardHeader className={cn("flex flex-row items-center gap-2 space-y-0 pb-2", headerClassName)}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[#0F52BA] transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
          <div className="min-w-0 flex-1 text-base font-semibold leading-tight">{title}</div>
        </button>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {headerActions}
          </div>
        ) : null}
      </CardHeader>
      {isOpen ? <CardContent className="space-y-3 text-sm">{children}</CardContent> : null}
    </Card>
  );
}
