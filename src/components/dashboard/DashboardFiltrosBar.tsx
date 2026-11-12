import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FILTROS_DASHBOARD_PADRAO,
  opcoesDeAno,
  opcoesDeMes,
  opcoesDeRegiao,
  type DashboardFiltros,
  type FiltroOpcao,
} from "@/lib/dashboard-filtros";

export function DashboardFiltrosBar({
  filtros,
  onChange,
  registros,
}: {
  filtros: DashboardFiltros;
  onChange: (filtros: DashboardFiltros) => void;
  registros: { mes: string; regiao: string }[];
}) {
  const anos = useMemo(() => opcoesDeAno(registros), [registros]);
  const meses = useMemo(() => opcoesDeMes(registros, filtros.ano), [registros, filtros.ano]);
  const regioes = useMemo(() => opcoesDeRegiao(registros), [registros]);
  const ativos = filtros.ano !== "todos" || filtros.mes !== "todos" || filtros.regiao !== "todas";

  const mudarAno = (ano: string) => {
    const mesesDoAno = opcoesDeMes(registros, ano);
    const mes = mesesDoAno.some((m) => m.value === filtros.mes) ? filtros.mes : "todos";
    onChange({ ...filtros, ano, mes });
  };

  return (
    <Card className="cpae-card mb-4 border-0 shadow-none">
      <CardContent className="grid items-end gap-3 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <FiltroSelect
          label="Ano"
          value={filtros.ano}
          onChange={mudarAno}
          options={[{ value: "todos", label: "Todos os anos" }, ...anos]}
        />
        <FiltroSelect
          label="Mês"
          value={filtros.mes}
          onChange={(mes) => onChange({ ...filtros, mes })}
          options={[{ value: "todos", label: "Todos os meses" }, ...meses]}
        />
        <FiltroSelect
          label="Região"
          value={filtros.regiao}
          onChange={(regiao) => onChange({ ...filtros, regiao })}
          options={[{ value: "todas", label: "Todas as regiões" }, ...regioes]}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={!ativos}
          onClick={() => onChange(FILTROS_DASHBOARD_PADRAO)}
        >
          Limpar filtros
        </Button>
      </CardContent>
    </Card>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FiltroOpcao[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[#64748B]">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
