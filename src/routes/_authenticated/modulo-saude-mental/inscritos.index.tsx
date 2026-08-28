import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, Eye, Search, Trash2 } from "lucide-react";
import { nivelEscolaridadeLabels } from "@/lib/saude-mental-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/inscritos/")({
  component: SaudeMentalInscritos,
});

const PAGE_SIZE = 20;

type Inscrito = {
  id: string;
  numero: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone_whatsapp: string | null;
  funcao: string | null;
  nivel_escolaridade: string | null;
  ano_curso: number;
  escola_texto: string | null;
  school_nome_snapshot: string | null;
  school_id: string | null;
  inscrito_em: string | null;
  created_at: string;
  origem: string;
};

function SaudeMentalInscritos() {
  const [filterNome, setFilterNome] = useState("");
  const [filterEscola, setFilterEscola] = useState("todas");
  const [filterAno, setFilterAno] = useState<string>("todos");
  const [filterVinculo, setFilterVinculo] = useState<"todas" | "vinculada" | "sem_vinculo">("todas");
  const [escolaOpen, setEscolaOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["saude-mental-inscritos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_inscritos")
        .select(
          "id, numero, nome_completo, cpf, email, telefone_whatsapp, funcao, nivel_escolaridade, ano_curso, escola_texto, school_nome_snapshot, school_id, inscrito_em, created_at, origem",
        )
        .is("deleted_at", null)
        .order("inscrito_em", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inscrito[];
    },
  });

  const anosOptions = Array.from(new Set(rows.map((r) => r.ano_curso).filter(Boolean))).sort(
    (a, b) => b - a,
  );

  const escolasOptions = Array.from(
    new Set(
      rows
        .map((r) => (r.school_nome_snapshot ?? r.escola_texto ?? "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtered = rows.filter((r) => {
    if (filterVinculo === "vinculada" && !r.school_id) return false;
    if (filterVinculo === "sem_vinculo" && r.school_id) return false;

    if (filterAno !== "todos" && String(r.ano_curso) !== filterAno) return false;

    if (filterEscola !== "todas") {
      const escolaNome = (r.school_nome_snapshot ?? r.escola_texto ?? "").trim();
      if (escolaNome !== filterEscola) return false;
    }

    if (filterNome.trim()) {
      const t = filterNome.trim().toLowerCase();
      if (!r.nome_completo.toLowerCase().includes(t)) return false;
    }

    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [filterNome, filterEscola, filterVinculo, filterAno]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const semVinculo = rows.filter((r) => !r.school_id).length;
  const hasActiveFilters =
    filterNome.trim().length > 0 ||
    filterEscola !== "todas" ||
    filterVinculo !== "todas" ||
    filterAno !== "todos";

  const clearFilters = () => {
    setFilterNome("");
    setFilterEscola("todas");
    setFilterVinculo("todas");
    setFilterAno("todos");
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Inscritos — Saúde Mental"
        description="Inscrições no Curso de Saúde Mental na Educação."
      />

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-0 flex-1 space-y-1.5 lg:min-w-[180px] lg:max-w-[280px]">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome…"
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                />
              </div>
            </div>

            <div className="min-w-0 w-full space-y-1.5 lg:w-[420px] lg:flex-none">
              <Label className="text-xs text-muted-foreground">Escolas</Label>
              <Popover open={escolaOpen} onOpenChange={setEscolaOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={escolaOpen}
                    className={cn(
                      "h-10 w-full justify-between font-normal",
                      filterEscola === "todas" && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {filterEscola === "todas" ? "Todas as escolas" : filterEscola}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar escola…" />
                    <CommandList>
                      <CommandEmpty>Nenhuma escola encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="todas as escolas"
                          onSelect={() => {
                            setFilterEscola("todas");
                            setEscolaOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filterEscola === "todas" ? "opacity-100" : "opacity-0",
                            )}
                          />
                          Todas as escolas
                        </CommandItem>
                        {escolasOptions.map((nome) => (
                          <CommandItem
                            key={nome}
                            value={nome}
                            onSelect={() => {
                              setFilterEscola(nome);
                              setEscolaOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                filterEscola === nome ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{nome}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-full space-y-1.5 lg:w-[140px]">
              <Label className="text-xs text-muted-foreground">Ano do curso</Label>
              <Select value={filterAno} onValueChange={setFilterAno}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anosOptions.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full space-y-1.5 lg:w-[220px]">
              <Label className="text-xs text-muted-foreground">Status de vínculo</Label>
              <Select
                value={filterVinculo}
                onValueChange={(v) => setFilterVinculo(v as typeof filterVinculo)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status de vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  <SelectItem value="vinculada">Com vínculo</SelectItem>
                  <SelectItem value="sem_vinculo">Sem vínculo ({semVinculo})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
              title="Limpar filtros"
              aria-label="Limpar filtros"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Ano do curso</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Escola</th>
                  <th className="px-3 py-2 font-medium">Função</th>
                  <th className="px-3 py-2 font-medium">Escolaridade</th>
                  <th className="px-3 py-2 font-medium">Contato</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum inscrito encontrado.
                    </td>
                  </tr>
                ) : (
                  paginated.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.ano_curso}</td>
                      <td className="px-3 py-2 font-medium">{r.nome_completo}</td>
                      <td className="px-3 py-2">
                        {r.school_id ? (
                          <span>{r.school_nome_snapshot ?? "—"}</span>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                              Sem vínculo
                            </Badge>
                            {r.escola_texto && (
                              <p className="text-xs text-muted-foreground">{r.escola_texto}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.funcao ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {nivelEscolaridadeLabels[r.nivel_escolaridade ?? ""] ??
                          r.nivel_escolaridade ??
                          "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <div>{r.email ?? "—"}</div>
                        <div>{r.telefone_whatsapp ?? ""}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/modulo-saude-mental/inscritos/$id" params={{ id: r.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length} inscrito(s)
              {semVinculo > 0 ? ` · ${semVinculo} sem vínculo de escola` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                {currentPage}/{totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
