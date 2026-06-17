import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { meetingTypeLabels, schoolRepresentativeLabels, visitTypeOptions } from "@/lib/labels";
import {
  buildDatetimeLocal,
  mergeVisitScheduleDefaults,
  parseDatetimeLocal,
  VISIT_SCHEDULE_HOURS,
  VISIT_SCHEDULE_MINUTES,
  type VisitScheduleFormValues,
} from "@/lib/appointment-utils";

function VisitScheduleDateTimeInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const parts = parseDatetimeLocal(value);

  const update = (patch: Partial<typeof parts>) => {
    onChange(buildDatetimeLocal({ ...parts, ...patch }));
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2">
        <Input
          type="date"
          required={required}
          value={parts.date}
          onChange={(e) => update({ date: e.target.value })}
        />
        <Select
          value={parts.hour || undefined}
          onValueChange={(hour) => update({ hour })}
          required={required}
        >
          <SelectTrigger aria-label={`Hora — ${label}`}>
            <SelectValue placeholder="Hora" />
          </SelectTrigger>
          <SelectContent>
            {VISIT_SCHEDULE_HOURS.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}h
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={parts.minute || undefined}
          onValueChange={(minute) => update({ minute })}
          required={required}
        >
          <SelectTrigger aria-label={`Minutos — ${label}`}>
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {VISIT_SCHEDULE_MINUTES.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export type VisitScheduleFormProps = {
  formKey?: string;
  defaultValues?: Partial<VisitScheduleFormValues>;
  submitLabel: string;
  onSubmit: (values: VisitScheduleFormValues) => void;
  onCancel: () => void;
  isPending?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
};

export function VisitScheduleForm({
  formKey,
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
  disabled,
  disabledMessage,
}: VisitScheduleFormProps) {
  const [values, setValues] = useState<VisitScheduleFormValues>(() =>
    mergeVisitScheduleDefaults(defaultValues),
  );

  useEffect(() => {
    setValues(mergeVisitScheduleDefaults(defaultValues));
  }, [formKey]);

  const set = <K extends keyof VisitScheduleFormValues>(key: K, val: VisitScheduleFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="representante-nome">Nome do representante da escola *</Label>
          <Input
            id="representante-nome"
            required
            value={values.representante_nome}
            onChange={(e) => set("representante_nome", e.target.value)}
            placeholder="Nome completo do contato na escola"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo *</Label>
          <Select value={values.representante_cargo} onValueChange={(v) => set("representante_cargo", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {Object.entries(schoolRepresentativeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipo da visita *</Label>
          <Select value={values.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {visitTypeOptions.map((k) => (
                <SelectItem key={k} value={k}>{meetingTypeLabels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <VisitScheduleDateTimeInput
          label="Início *"
          required
          value={values.inicio}
          onChange={(inicio) => set("inicio", inicio)}
        />
        <VisitScheduleDateTimeInput
          label="Término *"
          required
          value={values.fim}
          onChange={(fim) => set("fim", fim)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea
          rows={2}
          placeholder="Contato realizado, combinados, etc."
          value={values.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || disabled}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {disabledMessage && (
        <p className="text-xs text-warning-foreground">{disabledMessage}</p>
      )}
    </form>
  );
}
