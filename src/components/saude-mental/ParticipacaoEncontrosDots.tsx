import {
  formatDataBr,
  formatHorario,
  type ParticipacaoDot,
} from "@/lib/saude-mental-presenca-dashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  dots: ParticipacaoDot[];
  disabled?: boolean;
  onToggle?: (encontroId: string, presente: boolean) => void;
};

export function ParticipacaoEncontrosDots({ dots, disabled, onToggle }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-center gap-1">
        {dots.map((dot, idx) => {
          if (dot.encontro.id.startsWith("placeholder-")) {
            return (
              <span
                key={`ph-${idx}`}
                className="inline-block h-3 w-3 rounded-full bg-muted"
                aria-hidden
              />
            );
          }

          const pendente = dot.pendente ?? dot.futuro ?? false;

          const label = pendente
            ? `${dot.encontro.modulo_curso} · ${formatDataBr(dot.encontro.data)} — Pendente`
            : `${dot.encontro.modulo_curso} · ${formatDataBr(dot.encontro.data)} · ${formatHorario(dot.encontro.horario)} — ${
                dot.presente ? "Presente" : "Ausente"
              }`;

          const colorClass = pendente
            ? "bg-muted"
            : dot.presente
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-red-500 hover:bg-red-600";

          const canToggle = !disabled && !pendente && onToggle;

          const circle = (
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full transition-transform",
                colorClass,
                canToggle && "cursor-pointer hover:scale-125",
              )}
              role={canToggle ? "button" : undefined}
              tabIndex={canToggle ? 0 : undefined}
              onClick={
                canToggle
                  ? () => onToggle(dot.encontro.id, dot.presente)
                  : undefined
              }
              onKeyDown={
                canToggle
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle(dot.encontro.id, dot.presente);
                      }
                    }
                  : undefined
              }
            />
          );

          return (
            <Tooltip key={dot.encontro.id}>
              <TooltipTrigger asChild>{circle}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-center">
                {label}
                {canToggle ? (
                  <span className="mt-0.5 block text-[10px] opacity-80">
                    Clique para {dot.presente ? "remover" : "registrar"} presença
                  </span>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
