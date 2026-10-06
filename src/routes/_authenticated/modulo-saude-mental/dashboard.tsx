import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  GraduationCap,
  Loader2,
  MapPin,
  Percent,
  School,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { moduloCursoOptions, sexoLabels, sexoOptions } from "@/lib/saude-mental-options";
import {
  buildSaudeMentalDashboard,
  type ContagemBar,
  FILTROS_DASHBOARD_INICIAIS,
  filtrarFonteDashboard,
  labelRegiaoInscrito,
  type SmDashEncontro,
  type SmDashFiltros,
  type SmDashInscrito,
  type SmDashPresenca,
  type SaudeMentalDashboardData,
} from "@/lib/saude-mental-dashboard";
import { formatHorario } from "@/lib/saude-mental-presenca-dashboard";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/dashboard")({
  component: SaudeMentalDashboardPage,
});

const PAGE = 1000;
const ANO_ATUAL = new Date().getFullYear();

type DashFonte = {
  inscritos: SmDashInscrito[];
  encontros: SmDashEncontro[];
  presencas: SmDashPresenca[];
};

type DashView = SaudeMentalDashboardData & {
  fonte: DashFonte;
  fonteAnterior: DashFonte;
};

function variacaoRelativa(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

type EscolaJoin = { regiao: string | null; nome: string | null };

type InscritoRow = {
  id: string;
  school_id: string | null;
  sexo: string | null;
  funcao: string | null;
  nivel_escolaridade: string | null;
  status: string;
  ano_curso: number;
  cpf: string | null;
  escola_texto: string | null;
  school_nome_snapshot: string | null;
  school: EscolaJoin | EscolaJoin[] | null;
};

function escolaJoin(school: InscritoRow["school"]): EscolaJoin | null {
  if (!school) return null;
  if (Array.isArray(school)) return school[0] ?? null;
  return school;
}

async function fetchAnosCurso(): Promise<number[]> {
  const years = new Set<number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("saude_mental_inscritos")
      .select("ano_curso")
      .is("deleted_at", null)
      .order("ano_curso", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    for (const row of chunk) years.add(row.ano_curso);
    if (chunk.length < PAGE) break;
  }
  const list = [...years].sort((a, b) => b - a);
  return list.length > 0 ? list : [ANO_ATUAL];
}

async function fetchInscritos(ano: number): Promise<SmDashInscrito[]> {
  const rows: SmDashInscrito[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("saude_mental_inscritos")
      .select(
        "id, school_id, sexo, funcao, nivel_escolaridade, status, ano_curso, cpf, escola_texto, school_nome_snapshot, school:schools(regiao, nome)",
      )
      .is("deleted_at", null)
      .eq("ano_curso", ano)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as InscritoRow[];
    for (const row of chunk) {
      const escola = escolaJoin(row.school);
      const schoolId = row.school_id;
      rows.push({
        id: row.id,
        schoolId,
        escolaNome:
          escola?.nome?.trim() ||
          row.school_nome_snapshot?.trim() ||
          row.escola_texto?.trim() ||
          "Sem vínculo",
        regiao: escola?.regiao ?? null,
        regiaoLabel: labelRegiaoInscrito({ schoolId, regiao: escola?.regiao ?? null }),
        sexo: row.sexo,
        funcao: row.funcao,
        nivelEscolaridade: row.nivel_escolaridade,
        status: row.status,
        anoCurso: row.ano_curso,
        cpf: row.cpf,
      });
    }
    if (chunk.length < PAGE) break;
  }
  return rows;
}

async function fetchEncontros(ano: number): Promise<SmDashEncontro[]> {
  const { data, error } = await supabase
    .from("saude_mental_encontros")
    .select(
      "id, data, horario, local, modulo_curso, ano_curso, lista_presenca_fechada, qr_ativo, qr_expires_at",
    )
    .is("deleted_at", null)
    .eq("ano_curso", ano);
  if (error) throw error;
  return (data ?? []) as SmDashEncontro[];
}

async function fetchPresencas(encontroIds: string[]): Promise<SmDashPresenca[]> {
  if (encontroIds.length === 0) return [];
  const rows: SmDashPresenca[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("saude_mental_presencas")
      .select("id, inscrito_id, encontro_id, origem, cpf_informado")
      .in("encontro_id", encontroIds)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(
      ...chunk.map((row) => ({
        id: row.id,
        inscrito_id: row.inscrito_id,
        encontro_id: row.encontro_id,
        origem: row.origem,
        cpfInformado: row.cpf_informado,
      })),
    );
    if (chunk.length < PAGE) break;
  }
  return rows;
}

async function loadAno(ano: number): Promise<{ painel: SaudeMentalDashboardData; fonte: DashFonte }> {
  const [inscritos, encontros] = await Promise.all([fetchInscritos(ano), fetchEncontros(ano)]);
  const presencas = await fetchPresencas(encontros.map((item) => item.id));
  const fonte = { inscritos, encontros, presencas };
  return { painel: buildSaudeMentalDashboard(fonte), fonte };
}

function SaudeMentalDashboardPage() {
  const [ano, setAno] = useState(ANO_ATUAL);

  const anosQuery = useQuery({
    queryKey: ["saude-mental-dash-anos"],
    queryFn: fetchAnosCurso,
  });

  const anos = anosQuery.data ?? [ANO_ATUAL];

  useEffect(() => {
    if (anosQuery.data && !anosQuery.data.includes(ano)) {
      setAno(anosQuery.data[0] ?? ANO_ATUAL);
    }
  }, [ano, anosQuery.data]);

  const dashQuery = useQuery({
    queryKey: ["saude-mental-dashboard", ano],
    queryFn: async (): Promise<DashView> => {
      const [atual, anterior] = await Promise.all([loadAno(ano), loadAno(ano - 1)]);
      return {
        ...atual.painel,
        fonte: atual.fonte,
        fonteAnterior: anterior.fonte,
      };
    },
  });

  const data = dashQuery.data;

  return (
    <div>
      <PageHeader
        title="Painel de Saúde Mental"
        description="Inclusão e bem-estar no ambiente escolar"
        actions={
          <Select value={String(ano)} onValueChange={(value) => setAno(Number(value))}>
            <SelectTrigger className="w-[140px] rounded-full bg-white/80" aria-label="Ano do curso">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  Ano {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {dashQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando indicadores…
        </div>
      ) : dashQuery.isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar o dashboard. {dashQuery.error.message}
        </p>
      ) : data ? (
        <DashboardBody data={data} />
      ) : null}
    </div>
  );
}

function textoMaiorPresenca(rows: SaudeMentalDashboardData["regiaoComparacao"]): string {
  if (rows.length === 0) return "Sem inscritos para comparar.";
  if (rows.every((row) => row.presencas === 0)) {
    return "O percentual aparece quando houver CPF com presença registrada.";
  }
  const topo = rows[0]?.percentual ?? 0;
  const lideres = rows.filter((row) => row.percentual === topo).map((row) => row.name);
  if (lideres.length === 1) {
    return `${lideres[0]} tem o maior percentual de presença (${topo}%).`;
  }
  const lista =
    lideres.length === 2
      ? `${lideres[0]} e ${lideres[1]}`
      : `${lideres.slice(0, -1).join(", ")} e ${lideres[lideres.length - 1]}`;
  return `${lista} têm o maior percentual de presença (${topo}%).`;
}

function DashboardBody({ data }: { data: DashView }) {
  const [filtros, setFiltros] = useState<SmDashFiltros>(FILTROS_DASHBOARD_INICIAIS);

  const ativos = useMemo(
    () => data.fonte.inscritos.filter((row) => row.status !== "cancelado"),
    [data.fonte.inscritos],
  );

  const baseEscolas = useMemo(
    () =>
      filtros.regiao === "todas" ? ativos : ativos.filter((row) => row.regiaoLabel === filtros.regiao),
    [ativos, filtros.regiao],
  );

  const regioes = useMemo(() => {
    const nomes = new Set(ativos.map((row) => row.regiaoLabel).filter(Boolean));
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [ativos]);

  const escolas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const row of baseEscolas) {
      const nome = row.escolaNome?.trim();
      if (!nome) continue;
      mapa.set(row.schoolId ?? "sem-vinculo", nome);
    }
    return [...mapa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [baseEscolas]);

  const modulos = useMemo(() => {
    const presentes = new Set(data.fonte.encontros.map((row) => row.modulo_curso));
    return moduloCursoOptions.filter((item) => presentes.has(item.value));
  }, [data.fonte.encontros]);

  const sexos = useMemo(() => {
    const presentes = new Set<string>();
    for (const row of ativos) {
      presentes.add(row.sexo && sexoLabels[row.sexo] ? row.sexo : "nao_informado");
    }
    const conhecidos = sexoOptions
      .filter((item) => presentes.has(item.value))
      .map((item) => ({ value: item.value, label: item.label }));
    if (presentes.has("nao_informado")) {
      conhecidos.push({ value: "nao_informado", label: "Não informado" });
    }
    return conhecidos;
  }, [ativos]);

  useEffect(() => {
    setFiltros((atual) => {
      const escolaInvalida =
        atual.escola !== "todas" && !escolas.some((item) => item.id === atual.escola);
      const moduloInvalido =
        atual.modulo !== "todos" && !modulos.some((item) => item.value === atual.modulo);
      const sexoInvalido = atual.sexo !== "todos" && !sexos.some((item) => item.value === atual.sexo);
      const regiaoInvalida = atual.regiao !== "todas" && !regioes.includes(atual.regiao);
      if (!escolaInvalida && !moduloInvalido && !sexoInvalido && !regiaoInvalida) return atual;
      return {
        ...atual,
        escola: escolaInvalida ? "todas" : atual.escola,
        modulo: moduloInvalido ? "todos" : atual.modulo,
        sexo: sexoInvalido ? "todos" : atual.sexo,
        regiao: regiaoInvalida ? "todas" : atual.regiao,
      };
    });
  }, [escolas, modulos, sexos, regioes]);

  const painel = useMemo(
    () => buildSaudeMentalDashboard(filtrarFonteDashboard(data.fonte, filtros)),
    [data.fonte, filtros],
  );
  const painelAnterior = useMemo(
    () => buildSaudeMentalDashboard(filtrarFonteDashboard(data.fonteAnterior, filtros)),
    [data.fonteAnterior, filtros],
  );
  const variacaoInscritos = variacaoRelativa(painel.inscritos, painelAnterior.inscritos);
  const variacaoEscolas = variacaoRelativa(painel.escolas, painelAnterior.escolas);
  const variacaoParticipacao =
    painel.mediaParticipacaoPct === null || painelAnterior.mediaParticipacaoPct === null
      ? null
      : painel.mediaParticipacaoPct - painelAnterior.mediaParticipacaoPct;
  const graficos = {
    modulos: painel.modulos.filter((row) => row.estado === "fechada"),
    regiao: painel.regiaoComparacao,
    sexo: painel.sexo,
    funcao: painel.funcao,
    escolaridade: painel.escolaridade,
    inscritos: painel.inscritos,
  };

  const filtrosAtivos =
    filtros.regiao !== "todas" ||
    filtros.escola !== "todas" ||
    filtros.modulo !== "todos" ||
    filtros.sexo !== "todos";

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Inscritos"
          value={String(painel.inscritos)}
          icon={Users}
          tone="violet"
          variacao={variacaoInscritos}
          to="/modulo-saude-mental/inscritos"
        />
        <Kpi
          label="Escolas"
          value={String(painel.escolas)}
          icon={School}
          tone="blue"
          variacao={variacaoEscolas}
        />
        <Kpi
          label="Em vínculo"
          value={String(painel.semVinculo)}
          sub="Escola ainda não vinculada"
          icon={UserRound}
          tone="green"
          to="/modulo-saude-mental/inscritos"
        />
        <Kpi
          label="Participação"
          value={painel.mediaParticipacaoPct === null ? "—" : `${painel.mediaParticipacaoPct}%`}
          icon={Percent}
          tone="orange"
          variacao={variacaoParticipacao}
          to="/modulo-saude-mental/presenca"
        />
        <Kpi
          label="Listas em aberto"
          value={String(painel.listasEmAberto)}
          sub="Encontros passados sem fechar"
          icon={CalendarDays}
          tone="rose"
          alerta
          to="/modulo-saude-mental/presenca"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <EncontroCard titulo="Próximo encontro" encontro={painel.proximo} vazio="Nenhum encontro futuro neste ano." />
        <EncontroCard
          titulo="Último encontro"
          encontro={painel.ultimo}
          vazio="Nenhum encontro anterior neste ano."
          concluido
        />
      </div>

      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardContent className="grid items-end gap-3 p-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <FiltroSelect
            label="Região"
            value={filtros.regiao}
            onChange={(regiao) => setFiltros((atual) => ({ ...atual, regiao }))}
            options={[{ value: "todas", label: "Todas as regiões" }, ...regioes.map((nome) => ({ value: nome, label: nome }))]}
          />
          <FiltroSelect
            label="Escola"
            value={filtros.escola}
            onChange={(escola) => setFiltros((atual) => ({ ...atual, escola }))}
            options={[
              { value: "todas", label: "Todas as escolas" },
              ...escolas.map((item) => ({ value: item.id, label: item.nome })),
            ]}
          />
          <FiltroSelect
            label="Módulo"
            value={filtros.modulo}
            onChange={(modulo) => setFiltros((atual) => ({ ...atual, modulo }))}
            options={[
              { value: "todos", label: "Todos os módulos" },
              ...modulos.map((item) => ({ value: item.value, label: item.label })),
            ]}
          />
          <FiltroSelect
            label="Sexo"
            value={filtros.sexo}
            onChange={(sexo) => setFiltros((atual) => ({ ...atual, sexo }))}
            options={[{ value: "todos", label: "Todos" }, ...sexos]}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={!filtrosAtivos}
            onClick={() => setFiltros(FILTROS_DASHBOARD_INICIAIS)}
          >
            Limpar filtros
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <BarChart3 className="h-4 w-4" />
            </span>
            Presença por módulo
          </CardTitle>
          <span className="text-sm text-[#64748B]">
            Total de participantes: <strong className="text-[#0F172A]">{graficos.inscritos}</strong>
          </span>
        </CardHeader>
        <CardContent className="h-80">
          {graficos.modulos.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhum módulo com lista de presença fechada.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficos.modulos} margin={{ top: 28, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, (max: number) => Math.max(max * 1.12, 1)]} />
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const row = item.payload as (typeof graficos.modulos)[number];
                    return [row.rotulo, row.detalhe];
                  }}
                />
                <Bar dataKey="pct" name="Presença" radius={[8, 8, 0, 0]} maxBarSize={96} fill="#7c3aed">
                  <LabelList dataKey="rotulo" position="top" fill="#475569" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Users className="h-4 w-4" />
              </span>
              Inscritos por sexo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {graficos.sexo.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem inscritos neste ano.
              </div>
            ) : (
              <SexoDonut inscritos={graficos.inscritos} fatias={graficos.sexo} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <MapPin className="h-4 w-4" />
              </span>
              Inscritos e presença por região
            </CardTitle>
            <p className="text-sm text-muted-foreground">{textoMaiorPresenca(graficos.regiao)}</p>
          </CardHeader>
          <CardContent className="min-h-96 flex-1">
            {graficos.regiao.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem inscritos neste ano.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={graficos.regiao}
                  layout="vertical"
                  margin={{ left: 8, right: 72, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0.02 300)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.45))]}
                    stroke="oklch(0.5 0.02 300)"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    reversed
                    stroke="oklch(0.5 0.02 300)"
                    fontSize={12}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inscritos" name="Inscritos" fill="#c4b5fd" radius={[0, 6, 6, 0]} maxBarSize={14}>
                    <LabelList dataKey="inscritos" position="right" fill="#475569" fontSize={11} />
                  </Bar>
                  <Bar dataKey="presencas" name="CPFs com presença" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={14}>
                    <LabelList dataKey="rotuloPresenca" position="right" fill="#475569" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <ContagemCard
          titulo="Inscritos por escolaridade"
          icon={GraduationCap}
          dados={graficos.escolaridade}
          cor="#60a5fa"
        />
      </div>

      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Briefcase className="h-4 w-4" />
            </span>
            Inscritos por função
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {graficos.funcao.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem inscritos neste ano.</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-[#64748B]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Função</th>
                    <th className="px-3 py-2 text-right font-medium">Inscritos</th>
                    <th className="px-3 py-2 text-right font-medium">Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {graficos.funcao.map((row) => {
                    const pct =
                      graficos.inscritos > 0 ? Math.round((row.value / graficos.inscritos) * 100) : 0;
                    return (
                      <tr key={row.name} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-[#0F172A]">{row.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#0F172A]">{row.value}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#64748B]">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 border-t border-slate-200 bg-white text-[#0F172A]">
                  <tr>
                    <td className="px-3 py-2 font-medium">Total</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{graficos.inscritos}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
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
  options: { value: string; label: string }[];
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

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function dataBloco(iso: string, horario: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mesAno: `${MESES[d.getMonth()] ?? ""}/${d.getFullYear()}`,
    hora: formatHorario(horario),
  };
}

function EncontroCard({
  titulo,
  encontro,
  vazio,
  concluido = false,
}: {
  titulo: string;
  encontro: SaudeMentalDashboardData["proximo"];
  vazio: string;
  concluido?: boolean;
}) {
  const bloco = encontro ? dataBloco(encontro.data, encontro.horario) : null;
  const status = !encontro ? null : concluido && encontro.listaFechada ? "Concluído" : concluido ? "Em aberto" : "Agendado";

  return (
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            {titulo}
          </h2>
          {status && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                status === "Concluído" && "bg-emerald-50 text-emerald-700",
                status === "Agendado" && "bg-emerald-50 text-emerald-700",
                status === "Em aberto" && "bg-amber-50 text-amber-700",
              )}
            >
              {status}
            </span>
          )}
        </div>
        {!encontro || !bloco ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <div className="flex gap-3">
            <div className="flex w-[68px] shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 py-2 text-center">
              <span className="text-xl font-bold leading-none text-[#0F172A]">{bloco.dia}</span>
              <span className="mt-0.5 text-[10px] font-medium text-[#64748B]">{bloco.mesAno}</span>
              <span className="text-[10px] text-[#64748B]">{bloco.hora}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0F172A]">
                {encontro.modulo} · {encontro.data.split("-").reverse().join("/")} · {bloco.hora}
              </p>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-[#64748B]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{encontro.local}</span>
              </p>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-[#64748B]">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {concluido
                    ? `${encontro.listaFechada ? "Lista fechada" : "Lista em aberto"} · ${encontro.presentes} / ${encontro.inscritos} presentes (${encontro.pct}%) · ${encontro.viaQr} QR · ${encontro.viaManual} manual`
                    : `${encontro.presentes} presença(s) registrada(s)`}
                </span>
              </p>
              <Button asChild size="sm" className="mt-2 h-7 rounded-full bg-violet-600 px-3 text-xs hover:bg-violet-700">
                <Link to="/modulo-saude-mental/presenca">Abrir presença</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const KPI_TONES = {
  violet: { card: "bg-violet-50/40", icon: "bg-violet-100 text-violet-600" },
  blue: { card: "bg-sky-50/70", icon: "bg-sky-100 text-sky-600" },
  green: { card: "bg-emerald-50/70", icon: "bg-emerald-100 text-emerald-600" },
  orange: { card: "bg-orange-50/80", icon: "bg-orange-100 text-orange-500" },
  rose: { card: "bg-rose-50/70", icon: "bg-rose-100 text-rose-500" },
} as const;

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  variacao,
  alerta = false,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof KPI_TONES;
  variacao?: number | null;
  alerta?: boolean;
  to?: "/modulo-saude-mental/inscritos" | "/modulo-saude-mental/presenca";
}) {
  const palette = KPI_TONES[tone];
  const card = (
    <Card className={cn("h-full rounded-2xl border border-white/80 shadow-sm", palette.card, to && "cursor-pointer")}>
      <CardContent className="flex h-full flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", palette.icon)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            {label}
          </div>
          <Sparkline positiva={variacao == null ? null : variacao >= 0} alerta={alerta} />
        </div>
        <div className="text-2xl font-bold leading-none tabular-nums text-[#0F172A]">{value}</div>
        {variacao != null ? (
          <p className={cn("text-xs font-medium", variacao >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {variacao > 0 ? "+" : ""}
            {variacao}% em relação ao ano anterior
          </p>
        ) : (
          sub && (
            <p className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              {alerta && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
              {sub}
            </p>
          )
        )}
      </CardContent>
    </Card>
  );

  if (!to) return card;

  return (
    <Link
      to={to}
      className="block h-full rounded-2xl outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-violet-600/40"
    >
      {card}
    </Link>
  );
}

function Sparkline({ positiva, alerta }: { positiva: boolean | null; alerta?: boolean }) {
  const color = alerta ? "#f43f5e" : positiva === null ? "#94a3b8" : positiva ? "#22c55e" : "#f43f5e";
  const d = alerta || positiva === false ? "M2 6 C10 7 14 10 18 12 C24 16 28 14 34 18" : "M2 16 C10 14 14 10 20 8 C26 5 30 8 34 4";
  return (
    <svg width="40" height="16" viewBox="0 0 36 20" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ContagemCard({
  titulo,
  icon: Icon,
  dados,
  cor,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string }>;
  dados: ContagemBar[];
  cor: string;
}) {
  const altura = Math.max(384, dados.length * 36 + 16);
  return (
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Icon className="h-4 w-4" />
          </span>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent style={{ height: dados.length === 0 ? 384 : altura }}>
        {dados.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sem inscritos neste ano.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 64, top: 4, bottom: 4 }}>
              <XAxis type="number" hide domain={[0, (max: number) => Math.max(max * 1.4, 1)]} />
              <YAxis
                type="category"
                dataKey="name"
                width={108}
                reversed
                stroke="#94a3b8"
                fontSize={11}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
              />
              <Tooltip
                formatter={(_value, _name, item) => {
                  const row = item.payload as ContagemBar;
                  return [row.rotulo, row.name];
                }}
              />
              <Bar dataKey="value" name="Inscritos" fill={cor} radius={[0, 6, 6, 0]} maxBarSize={18}>
                <LabelList dataKey="rotulo" position="right" fill="#475569" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function SexoDonut({
  inscritos,
  fatias,
}: {
  inscritos: number;
  fatias: SaudeMentalDashboardData["sexo"];
}) {
  const total = fatias.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <div className="grid h-full grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_180px]">
      <div className="relative h-full min-h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={fatias} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
              {fatias.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-[#0F172A]">{inscritos}</span>
          <span className="text-xs text-[#94A3B8]">inscritos</span>
        </div>
      </div>
      <ul className="space-y-3 text-sm">
        {fatias.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li key={slice.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#475569]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.fill }} />
                {slice.name}
              </span>
              <span className="tabular-nums text-[#0F172A]">
                {slice.value} <span className="text-[#94A3B8]">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
