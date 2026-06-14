import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { meetingTypeLabels, schoolRepresentativeLabels, visitTypeOptions } from "@/lib/labels";
import {
  mergeVisitScheduleDefaults,
  type VisitScheduleFormValues,
} from "@/lib/appointment-utils";

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
      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="space-y-1.5">
          <Label>Início *</Label>
          <Input
            type="datetime-local"
            required
            value={values.inicio}
            onChange={(e) => set("inicio", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Término *</Label>
          <Input
            type="datetime-local"
            required
            value={values.fim}
            onChange={(e) => set("fim", e.target.value)}
          />
        </div>
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
