import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  meetingReferralOptions,
  type MeetingReferralOption,
} from "@/lib/meeting-referral-options";

type MeetingReferralOptionsFieldProps = {
  value: MeetingReferralOption[];
  onChange: (value: MeetingReferralOption[]) => void;
  disabled?: boolean;
};

export function MeetingReferralOptionsField({
  value,
  onChange,
  disabled,
}: MeetingReferralOptionsFieldProps) {
  const toggle = (option: MeetingReferralOption, checked: boolean) => {
    if (checked) {
      onChange([...value, option]);
      return;
    }
    onChange(value.filter((v) => v !== option));
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Label className="text-sm font-medium">Opções de encaminhamento:</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {meetingReferralOptions.map((option) => {
          const id = `referral-${option.value}`;
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(state) => toggle(option.value, state === true)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function MeetingReferralOptionsDisplay({ values }: { values: unknown }) {
  const selected = meetingReferralOptions.filter((o) =>
    Array.isArray(values) ? values.includes(o.value) : false,
  );

  if (selected.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">Opções de encaminhamento:</div>
      <p className="text-sm">{selected.map((o) => o.label).join(", ")}</p>
    </div>
  );
}
