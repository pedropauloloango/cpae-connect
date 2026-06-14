import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { schoolTipoLabels } from "@/lib/labels";

export type PublicSchoolOption = {
  id: string;
  nome: string;
  regiao: string | null;
  tipo_escola: "escola" | "emei" | null;
};

type SchoolSearchSelectProps = {
  schools: PublicSchoolOption[];
  value: string | null;
  onSelect: (school: PublicSchoolOption) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
};

export function SchoolSearchSelect({
  schools,
  value,
  onSelect,
  disabled,
  loading,
  placeholder = "Selecione a escola ou EMEI…",
  searchPlaceholder = "Buscar escola ou EMEI…",
  emptyLabel = "Nenhuma escola encontrada.",
}: SchoolSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = schools.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn("h-10 w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">
            {loading ? "Carregando escolas…" : selected ? selected.nome : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {schools.map((school) => (
                <CommandItem
                  key={school.id}
                  value={`${school.nome} ${schoolTipoLabels[school.tipo_escola ?? "escola"]}`}
                  onSelect={() => {
                    onSelect(school);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === school.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{school.nome}</span>
                  <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                    {schoolTipoLabels[school.tipo_escola ?? "escola"]}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
