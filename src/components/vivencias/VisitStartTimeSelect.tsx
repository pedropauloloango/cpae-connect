import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VISIT_SCHEDULE_HOURS, VISIT_SCHEDULE_MINUTES } from "@/lib/appointment-utils";
import { buildHoraInicio, parseHoraInicio } from "@/lib/vivencia-schedule";

type VisitStartTimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Dois seletores: hora (07–21) e minuto (00/15/30/45). */
export function VisitStartTimeSelect({
  value,
  onChange,
  disabled,
  className,
}: VisitStartTimeSelectProps) {
  const { hour, minute } = parseHoraInicio(value);

  const update = (nextHour: string, nextMinute: string) => {
    if (!nextHour || !nextMinute) {
      onChange("");
      return;
    }
    onChange(buildHoraInicio(nextHour, nextMinute));
  };

  return (
    <div className={className ?? "grid grid-cols-2 gap-2"}>
      <Select
        value={hour || undefined}
        onValueChange={(h) => update(h, minute || "00")}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Hora de início">
          <SelectValue placeholder="Hora" />
        </SelectTrigger>
        <SelectContent>
          {VISIT_SCHEDULE_HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}h
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={minute || undefined}
        onValueChange={(m) => update(hour || "07", m)}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Minuto de início">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {VISIT_SCHEDULE_MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
