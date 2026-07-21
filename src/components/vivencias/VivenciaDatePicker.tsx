import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fetchPalestraOccupiedDates,
  fetchVivenciaOccupiedDates,
  isWeekday,
  parseDateKey,
  startOfToday,
  toDateKey,
} from "@/lib/vivencia-occupied-dates";

type VivenciaDatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  regiao?: string | null;
  /** Obrigatório para vivências (região + período). Ignorado em palestras. */
  periodo?: string | null;
  kind?: "vivencia" | "palestra";
  /** Datas já escolhidas em outras turmas do mesmo formulário (mesmo período). */
  extraOccupiedDates?: string[];
  disabled?: boolean;
  className?: string;
};

export function VivenciaDatePicker({
  value,
  onChange,
  regiao,
  periodo,
  kind = "vivencia",
  extraOccupiedDates = [],
  disabled,
  className,
}: VivenciaDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = startOfToday();
  const isPalestra = kind === "palestra";

  const canColorize = isPalestra
    ? Boolean(regiao?.trim())
    : Boolean(regiao?.trim() && periodo?.trim());

  const { data: remoteOccupied = [], isFetching } = useQuery({
    queryKey: isPalestra
      ? ["palestra-occupied-dates", regiao]
      : ["vivencia-occupied-dates", regiao, periodo],
    queryFn: () =>
      isPalestra
        ? fetchPalestraOccupiedDates(regiao)
        : fetchVivenciaOccupiedDates(regiao, periodo),
    enabled: canColorize,
    staleTime: 60_000,
  });

  const occupiedSet = useMemo(() => {
    const set = new Set(remoteOccupied);
    for (const d of extraOccupiedDates) {
      if (d) set.add(d.slice(0, 10));
    }
    if (value) set.delete(value.slice(0, 10));
    return set;
  }, [remoteOccupied, extraOccupiedDates, value]);

  const selected = value ? parseDateKey(value) : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start rounded-md border-input bg-background px-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            {value
              ? parseDateKey(value).toLocaleDateString("pt-BR")
              : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            onSelect={(date) => {
              if (!date) {
                onChange("");
                return;
              }
              onChange(toDateKey(date));
              setOpen(false);
            }}
            disabled={(date) => date < today}
            modifiers={{
              available: (date) =>
                canColorize &&
                isWeekday(date) &&
                date >= today &&
                !occupiedSet.has(toDateKey(date)),
              occupied: (date) =>
                canColorize && isWeekday(date) && occupiedSet.has(toDateKey(date)),
            }}
            modifiersClassNames={{
              available:
                "[&_button]:bg-emerald-100 [&_button]:text-emerald-900 [&_button]:hover:bg-emerald-200",
              occupied:
                "[&_button]:bg-orange-200 [&_button]:text-orange-950 [&_button]:hover:bg-orange-300",
            }}
            defaultMonth={selected ?? today}
            formatters={{
              formatCaption: (date) => {
                const label = date.toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                });
                return label.charAt(0).toUpperCase() + label.slice(1);
              },
              formatWeekdayName: (date) =>
                date
                  .toLocaleDateString("pt-BR", { weekday: "short" })
                  .replace(/\.$/, "")
                  .replace(/^./, (c) => c.toUpperCase()),
            }}
          />
          <div className="space-y-1.5 border-t px-3 py-2.5 text-xs text-muted-foreground">
            {!canColorize ? (
              <p>
                {isPalestra
                  ? "Selecione a escola (região) para ver disponibilidade."
                  : "Selecione a região da escola e o período da turma para ver disponibilidade."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
                    Disponível (seg–sex)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-orange-200 ring-1 ring-orange-300" />
                    {isPalestra
                      ? "Já há vivência ou palestra nesta região"
                      : "Já há solicitação neste período"}
                  </span>
                </div>
                {isFetching && <p>Atualizando datas…</p>}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
