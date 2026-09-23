import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  countSiblingDatesOnDay,
  fetchPalestraSchoolOccupiedDates,
  fetchVivenciaDateCounts,
  isWeekday,
  parseDateKey,
  startOfToday,
  toDateKey,
  vivenciaCalendarDayState,
} from "@/lib/vivencia-occupied-dates";
import {
  MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO,
  WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO,
} from "@/lib/vivencias-options";

type VivenciaDatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  regiao?: string | null;
  /** Escola selecionada — usado no limite de palestras por escola/período. */
  schoolId?: string | null;
  /** Obrigatório para colorir disponibilidade (vivência: região+período; palestra: escola+período). */
  periodo?: string | null;
  kind?: "vivencia" | "palestra";
  /** Datas já no limite (bloqueadas) por outras turmas/palestras do formulário. */
  extraOccupiedDates?: string[];
  /** Outras datas do formulário no mesmo período (contam para alerta/bloqueio de vivência). */
  siblingDates?: string[];
  disabled?: boolean;
  className?: string;
};

export function VivenciaDatePicker({
  value,
  onChange,
  regiao,
  schoolId,
  periodo,
  kind = "vivencia",
  extraOccupiedDates = [],
  siblingDates = [],
  disabled,
  className,
}: VivenciaDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = startOfToday();
  const isPalestra = kind === "palestra";

  const canColorize = isPalestra
    ? Boolean(schoolId?.trim() && periodo?.trim())
    : Boolean(regiao?.trim() && periodo?.trim());

  const { data: remoteOccupied = [], isFetching: fetchingPalestra } = useQuery({
    queryKey: ["palestra-school-occupied-dates", schoolId, periodo],
    queryFn: () => fetchPalestraSchoolOccupiedDates(schoolId, periodo),
    enabled: canColorize && isPalestra,
    staleTime: 60_000,
  });

  const { data: remoteCounts = new Map<string, number>(), isFetching: fetchingVivencia } =
    useQuery({
      queryKey: ["vivencia-date-counts", regiao, periodo],
      queryFn: () => fetchVivenciaDateCounts(regiao, periodo),
      enabled: canColorize && !isPalestra,
      staleTime: 60_000,
    });

  const isFetching = isPalestra ? fetchingPalestra : fetchingVivencia;

  const palestraBlockedSet = useMemo(() => {
    const set = new Set(remoteOccupied);
    for (const d of extraOccupiedDates) {
      if (d) set.add(d.slice(0, 10));
    }
    if (value) set.delete(value.slice(0, 10));
    return set;
  }, [remoteOccupied, extraOccupiedDates, value]);

  const dayState = useMemo(() => {
    if (isPalestra) return null;
    const blocked = new Set<string>();
    const warning = new Set<string>();
    const days = new Set<string>([
      ...remoteCounts.keys(),
      ...siblingDates.map((d) => d.slice(0, 10)).filter(Boolean),
      ...extraOccupiedDates.map((d) => d.slice(0, 10)).filter(Boolean),
    ]);
    for (const day of days) {
      const remote = remoteCounts.get(day) ?? 0;
      const formCount = countSiblingDatesOnDay(siblingDates, day);
      const state = vivenciaCalendarDayState(remote, formCount);
      if (state.blocked || extraOccupiedDates.some((d) => d.slice(0, 10) === day)) {
        blocked.add(day);
      } else if (state.warning) {
        warning.add(day);
      }
    }
    if (value) {
      const key = value.slice(0, 10);
      blocked.delete(key);
      // Mantém alerta visual na data selecionada se ainda houver carga na região/formulário.
      const remote = remoteCounts.get(key) ?? 0;
      const formCount = countSiblingDatesOnDay(siblingDates, key);
      const state = vivenciaCalendarDayState(remote, formCount);
      if (!state.blocked && state.warning) warning.add(key);
      else warning.delete(key);
    }
    return { blocked, warning };
  }, [isPalestra, remoteCounts, siblingDates, extraOccupiedDates, value]);

  const isBlocked = (key: string) =>
    isPalestra ? palestraBlockedSet.has(key) : Boolean(dayState?.blocked.has(key));

  const isWarning = (key: string) =>
    !isPalestra && Boolean(dayState?.warning.has(key)) && !isBlocked(key);

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
              const key = toDateKey(date);
              if (canColorize && isBlocked(key)) {
                return;
              }
              onChange(key);
              setOpen(false);
            }}
            disabled={(date) => canColorize && isBlocked(toDateKey(date))}
            modifiers={{
              available: (date) =>
                canColorize &&
                isWeekday(date) &&
                !isBlocked(toDateKey(date)) &&
                !isWarning(toDateKey(date)),
              warning: (date) =>
                canColorize && isWeekday(date) && isWarning(toDateKey(date)),
              occupied: (date) =>
                canColorize && isWeekday(date) && isBlocked(toDateKey(date)),
            }}
            modifiersClassNames={{
              available:
                "[&_button]:bg-emerald-100 [&_button]:text-emerald-900 [&_button]:hover:bg-emerald-200",
              warning:
                "[&_button]:bg-orange-200 [&_button]:text-orange-950 [&_button]:hover:bg-orange-300",
              occupied:
                "[&_button]:bg-orange-300 [&_button]:text-orange-950 [&_button]:opacity-60 [&_button]:hover:bg-orange-300",
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
                  ? "Selecione a escola e o período para ver disponibilidade."
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
                      ? "Esta escola já solicitou palestra neste dia/período (não selecionável)"
                      : `Alerta: ${WARN_TURMAS_VIVENCIA_POR_DIA_PERIODO}+ turmas (selecionável)`}
                  </span>
                  {!isPalestra && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-orange-300 ring-1 ring-orange-400 opacity-80" />
                      Bloqueado: {MAX_TURMAS_VIVENCIA_POR_DIA_PERIODO} turmas
                    </span>
                  )}
                </div>
                <p>Datas passadas também podem ser selecionadas.</p>
                {isFetching && <p>Atualizando datas…</p>}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
