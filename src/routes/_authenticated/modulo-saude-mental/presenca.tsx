import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { moduloCursoOptions } from "@/lib/saude-mental-options";
import {
  buildPresencaQrFilename,
  buildPresencaQrUrl,
  downloadQrCodePng,
  isRecebimentoPresencaAtivo,
} from "@/lib/saude-mental-presenca";
import {
  buildPresencaKey,
  buildPresencaSet,
  calcParticipacao,
  calcPresencaTotais,
  escolaInscritoLabel,
  filterEncontros,
  formatDataBr,
  formatHorario,
  type PresencaEncontroRef,
  type PresencaInscritoRef,
  type PresencaRegistroRef,
  ENCONTROS_CURSO_COLS,
} from "@/lib/saude-mental-presenca-dashboard";
import { ParticipacaoEncontrosDots } from "@/components/saude-mental/ParticipacaoEncontrosDots";
import { exportListaPresencaPrint } from "@/lib/saude-mental-lista-presenca";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Check,
  Copy,
  Download,
  FileDown,
  Loader2,
  QrCode,
  Search,
  Trash2,
  AlertTriangle,
  Users,
  CalendarDays,
  CheckCircle2,
  Percent,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/presenca")({
  component: SaudeMentalPresencaPage,
});

type Encontro = PresencaEncontroRef & {
  local: string;
  status: string;
  qr_token: string;
  qr_ativo: boolean;
  qr_expires_at: string | null;
  lista_presenca_fechada: boolean;
};

type Inscrito = PresencaInscritoRef;

type Presenca = PresencaRegistroRef & {
  origem: string;
  registrado_em: string;
  registrado_ip: string | null;
};

type PresencaFilter = "todos" | "presentes" | "ausentes" | "ip_duplicado";

const presencaFilterOptions: { value: PresencaFilter; label: string }[] = [
  { value: "todos", label: "Todos os inscritos" },
  { value: "presentes", label: "Com presença registrada" },
  { value: "ausentes", label: "Sem presença registrada" },
  { value: "ip_duplicado", label: "Mesmo IP em vários CPFs" },
];

const PAGE_SIZE = 25;
const ANO_ATUAL = String(new Date().getFullYear());

function SaudeMentalPresencaPage() {
  const qc = useQueryClient();
  const [filterNome, setFilterNome] = useState("");
  const [filterEscola, setFilterEscola] = useState("todas");
  const [filterModulo, setFilterModulo] = useState("todos");
  const [filterAno, setFilterAno] = useState(ANO_ATUAL);
  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [filterPresenca, setFilterPresenca] = useState<PresencaFilter>("todos");
  const [encontroManualId, setEncontroManualId] = useState("");
  const [draftSelected, setDraftSelected] = useState<Set<string>>(new Set());
  const [draftSyncedKey, setDraftSyncedKey] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ presencaId: string; nome: string } | null>(
    null,
  );
  const [clearEncontroOpen, setClearEncontroOpen] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [page, setPage] = useState(1);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEncontroId, setQrEncontroId] = useState("");
  const qrSvgWrapRef = useRef<HTMLDivElement>(null);

  const { data: encontros = [], isLoading: loadingEncontros } = useQuery({
    queryKey: ["saude-mental-encontros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_encontros")
        .select(
          "id, data, horario, local, modulo_curso, status, ano_curso, qr_token, qr_ativo, qr_expires_at, lista_presenca_fechada",
        )
        .is("deleted_at", null)
        .order("data", { ascending: true })
        .order("horario", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Encontro[];
    },
  });

  const { data: inscritos = [], isLoading: loadingInscritos } = useQuery({
    queryKey: ["saude-mental-inscritos-presenca-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_inscritos")
        .select("id, nome_completo, cpf, escola_texto, school_nome_snapshot, ano_curso")
        .is("deleted_at", null)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Inscrito[];
    },
  });

  const { data: presencas = [], isLoading: loadingPresencas } = useQuery({
    queryKey: ["saude-mental-presencas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saude_mental_presencas")
        .select("id, encontro_id, inscrito_id, origem, registrado_em, registrado_ip");
      if (error) throw error;
      return (data ?? []) as Presenca[];
    },
  });

  const presencaSet = useMemo(() => buildPresencaSet(presencas), [presencas]);
  const presencaByKey = useMemo(() => {
    const map = new Map<string, Presenca>();
    for (const p of presencas) map.set(buildPresencaKey(p.inscrito_id, p.encontro_id), p);
    return map;
  }, [presencas]);

  const encontrosFiltrados = useMemo(
    () =>
      filterEncontros(encontros, {
        modulo: filterModulo,
        ano: filterAno,
        dataDe: filterDataDe || undefined,
        dataAte: filterDataAte || undefined,
      }),
    [encontros, filterModulo, filterAno, filterDataDe, filterDataAte],
  );

  const encontroManual = encontros.find((e) => e.id === encontroManualId) ?? null;

  const presencasEncontroManual = useMemo(
    () => (encontroManualId ? presencas.filter((p) => p.encontro_id === encontroManualId) : []),
    [presencas, encontroManualId],
  );

  const savedPresentIds = useMemo(
    () => new Set(presencasEncontroManual.map((p) => p.inscrito_id)),
    [presencasEncontroManual],
  );

  useEffect(() => {
    if (!encontroManualId || loadingPresencas) return;
    const key = `${encontroManualId}:${[...savedPresentIds].sort().join(",")}`;
    if (key === draftSyncedKey) return;
    setDraftSelected(new Set(savedPresentIds));
    setDraftSyncedKey(key);
  }, [encontroManualId, loadingPresencas, savedPresentIds, draftSyncedKey]);

  useEffect(() => {
    setFilterPresenca("todos");
    setDraftSyncedKey("");
    setDraftSelected(new Set());
  }, [encontroManualId]);

  const ipUsageByEncontroManual = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of presencasEncontroManual) {
      const ip = p.registrado_ip?.trim();
      if (!ip) continue;
      map.set(ip, (map.get(ip) ?? 0) + 1);
    }
    return map;
  }, [presencasEncontroManual]);

  const duplicateIpsManual = useMemo(
    () =>
      [...ipUsageByEncontroManual.entries()]
        .filter(([, count]) => count > 1)
        .map(([ip]) => ip),
    [ipUsageByEncontroManual],
  );

  const escolasOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inscritos
            .filter((i) => filterAno === "todos" || String(i.ano_curso) === filterAno)
            .map((i) => escolaInscritoLabel(i))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [inscritos, filterAno],
  );

  const anosOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...inscritos.map((i) => i.ano_curso),
          ...encontros.map((e) => e.ano_curso),
        ]),
      )
        .filter(Boolean)
        .sort((a, b) => b - a),
    [inscritos, encontros],
  );

  const inscritosFiltrados = useMemo(() => {
    let list = inscritos;
    if (filterAno !== "todos") list = list.filter((i) => String(i.ano_curso) === filterAno);
    if (filterEscola !== "todas") {
      list = list.filter((i) => escolaInscritoLabel(i) === filterEscola);
    }
    const t = filterNome.trim().toLowerCase();
    if (t) list = list.filter((i) => i.nome_completo.toLowerCase().includes(t));

    if (filterPresenca !== "todos" && encontroManualId) {
      list = list.filter((i) => {
        const presente = savedPresentIds.has(i.id);
        if (filterPresenca === "presentes") return presente;
        if (filterPresenca === "ausentes") return !presente;
        if (filterPresenca === "ip_duplicado") {
          const presenca = presencasEncontroManual.find((p) => p.inscrito_id === i.id);
          const ip = presenca?.registrado_ip?.trim();
          return ip ? (ipUsageByEncontroManual.get(ip) ?? 0) > 1 : false;
        }
        return true;
      });
    }

    return list;
  }, [
    inscritos,
    filterAno,
    filterEscola,
    filterNome,
    filterPresenca,
    encontroManualId,
    savedPresentIds,
    presencasEncontroManual,
    ipUsageByEncontroManual,
  ]);

  const totais = useMemo(
    () => calcPresencaTotais(inscritosFiltrados, encontrosFiltrados, presencaSet),
    [inscritosFiltrados, encontrosFiltrados, presencaSet],
  );

  const encontrosDotsCols = useMemo(
    () => encontrosFiltrados.slice(0, ENCONTROS_CURSO_COLS),
    [encontrosFiltrados],
  );

  const toAdd = useMemo(
    () => [...draftSelected].filter((id) => !savedPresentIds.has(id)),
    [draftSelected, savedPresentIds],
  );
  const toRemove = useMemo(
    () => [...savedPresentIds].filter((id) => !draftSelected.has(id)),
    [draftSelected, savedPresentIds],
  );
  const hasPendingChanges = encontroManualId.length > 0 && (toAdd.length > 0 || toRemove.length > 0);
  const podeConfirmarLista =
    !!encontroManualId && (hasPendingChanges || !encontroManual?.lista_presenca_fechada);

  const inscritosAnoManual = useMemo(() => {
    if (!encontroManual) return [];
    return inscritos.filter((i) => i.ano_curso === encontroManual.ano_curso);
  }, [inscritos, encontroManual]);

  useEffect(() => {
    setPage(1);
  }, [
    filterNome,
    filterEscola,
    filterModulo,
    filterAno,
    filterDataDe,
    filterDataAte,
    filterPresenca,
    encontroManualId,
  ]);

  const totalPages = Math.max(1, Math.ceil(inscritosFiltrados.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginated = inscritosFiltrados.slice(pageStart, pageStart + PAGE_SIZE);

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!encontroManualId) throw new Error("Selecione um encontro para registrar presenças.");

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("saude_mental_presencas")
          .delete()
          .eq("encontro_id", encontroManualId)
          .in("inscrito_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const payload = toAdd.map((inscritoId) => {
          const inscrito = inscritos.find((i) => i.id === inscritoId);
          return {
            encontro_id: encontroManualId,
            inscrito_id: inscritoId,
            cpf_informado: inscrito?.cpf ?? null,
            origem: "manual" as const,
          };
        });
        const { error } = await supabase.from("saude_mental_presencas").insert(payload);
        if (error) throw error;
      }

      const { error: fechadaError } = await supabase
        .from("saude_mental_encontros")
        .update({ lista_presenca_fechada: true })
        .eq("id", encontroManualId);
      if (fechadaError) throw fechadaError;
    },
    onSuccess: () => {
      const presentes = draftSelected.size;
      const ausentes = Math.max(0, inscritosAnoManual.length - presentes);
      toast.success("Lista de presença confirmada.", {
        description: `${presentes} presente(s) e ${ausentes} ausente(s) registrados para este encontro.`,
      });
      void qc.invalidateQueries({ queryKey: ["saude-mental-presencas-all"] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
      setDraftSyncedKey("");
    },
    onError: (e: Error) => toast.error("Erro ao confirmar", { description: e.message }),
  });

  const deletePresencaMut = useMutation({
    mutationFn: async ({ presencaId, encontroId }: { presencaId: string; encontroId: string }) => {
      const { error } = await supabase.from("saude_mental_presencas").delete().eq("id", presencaId);
      if (error) throw error;

      const { count, error: countError } = await supabase
        .from("saude_mental_presencas")
        .select("id", { count: "exact", head: true })
        .eq("encontro_id", encontroId);
      if (countError) throw countError;
      if ((count ?? 0) === 0) {
        const { error: reopenError } = await supabase
          .from("saude_mental_encontros")
          .update({ lista_presenca_fechada: false })
          .eq("id", encontroId);
        if (reopenError) throw reopenError;
      }
    },
    onSuccess: () => {
      toast.success("Presença excluída.");
      setDeleteTarget(null);
      setDraftSyncedKey("");
      void qc.invalidateQueries({ queryKey: ["saude-mental-presencas-all"] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao excluir presença", { description: e.message }),
  });

  const clearEncontroPresencasMut = useMutation({
    mutationFn: async (encontroId: string) => {
      const { error: deleteError } = await supabase
        .from("saude_mental_presencas")
        .delete()
        .eq("encontro_id", encontroId);
      if (deleteError) throw deleteError;

      const { error: reopenError } = await supabase
        .from("saude_mental_encontros")
        .update({ lista_presenca_fechada: false })
        .eq("id", encontroId);
      if (reopenError) throw reopenError;
    },
    onSuccess: () => {
      toast.success("Todos os registros deste encontro foram excluídos.");
      setClearEncontroOpen(false);
      setDraftSelected(new Set());
      setDraftSyncedKey("");
      void qc.invalidateQueries({ queryKey: ["saude-mental-presencas-all"] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao limpar encontro", { description: e.message }),
  });

  const reabrirListasVaziasMut = useMutation({
    mutationFn: async (encontroIds: string[]) => {
      if (encontroIds.length === 0) return;
      const { error } = await supabase
        .from("saude_mental_encontros")
        .update({ lista_presenca_fechada: false })
        .in("id", encontroIds);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saude-mental-encontros"] });
    },
  });

  useEffect(() => {
    if (loadingEncontros || loadingPresencas || reabrirListasVaziasMut.isPending) return;
    const comPresenca = new Set(presencas.map((p) => p.encontro_id));
    const ids = encontros
      .filter((e) => e.lista_presenca_fechada && !comPresenca.has(e.id))
      .map((e) => e.id);
    if (ids.length > 0) reabrirListasVaziasMut.mutate(ids);
  }, [encontros, presencas, loadingEncontros, loadingPresencas, reabrirListasVaziasMut.isPending]);

  const togglePresencaMut = useMutation({
    mutationFn: async ({
      inscritoId,
      encontroId,
      presente,
      cpf,
    }: {
      inscritoId: string;
      encontroId: string;
      presente: boolean;
      cpf: string | null;
    }) => {
      if (presente) {
        const key = buildPresencaKey(inscritoId, encontroId);
        const registro = presencaByKey.get(key);
        if (!registro) return;
        const { error } = await supabase.from("saude_mental_presencas").delete().eq("id", registro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saude_mental_presencas").insert({
          encontro_id: encontroId,
          inscrito_id: inscritoId,
          cpf_informado: cpf,
          origem: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.presente ? "Presença removida." : "Presença registrada.");
      void qc.invalidateQueries({ queryKey: ["saude-mental-presencas-all"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar presença", { description: e.message }),
  });

  const qrEncontro = encontros.find((e) => e.id === qrEncontroId) ?? null;
  const qrUrl = qrEncontro ? buildPresencaQrUrl(qrEncontro.qr_token) : "";

  const handleExport = async (encontroId = encontroManualId) => {
    const encontro = encontros.find((e) => e.id === encontroId);
    if (!encontro) {
      toast.error("Selecione um encontro para imprimir a lista.");
      return;
    }
    const anoInscritos = inscritos.filter((i) => i.ano_curso === encontro.ano_curso);
    const presentesSet =
      encontroId === encontroManualId
        ? draftSelected
        : new Set(
            presencas.filter((p) => p.encontro_id === encontroId).map((p) => p.inscrito_id),
          );
    try {
      await exportListaPresencaPrint(
        {
          modulo_curso: encontro.modulo_curso,
          data: encontro.data,
          horario: encontro.horario,
          local: encontro.local,
          ano_curso: encontro.ano_curso,
        },
        anoInscritos.map((i) => ({
          nome_completo: i.nome_completo,
          cpf: i.cpf,
          escola: escolaInscritoLabel(i) || null,
          presente: presentesSet.has(i.id),
        })),
      );
    } catch (e) {
      toast.error("Erro ao exportar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const toggleDraft = (inscritoId: string, checked: boolean) => {
    setDraftSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(inscritoId);
      else next.delete(inscritoId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (!encontroManualId) return;
    setDraftSelected((prev) => {
      const next = new Set(prev);
      for (const i of inscritosFiltrados) next.add(i.id);
      return next;
    });
  };

  const clearFiltered = () => {
    if (!encontroManualId) return;
    setDraftSelected((prev) => {
      const next = new Set(prev);
      for (const i of inscritosFiltrados) next.delete(i.id);
      return next;
    });
  };

  const isLoading = loadingEncontros || loadingInscritos || loadingPresencas;

  const clearFilters = () => {
    setFilterNome("");
    setFilterEscola("todas");
    setFilterModulo("todos");
    setFilterAno(ANO_ATUAL);
    setFilterDataDe("");
    setFilterDataAte("");
    setFilterPresenca("todos");
    setEncontroManualId("");
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterNome.trim()) count++;
    if (filterEscola !== "todas") count++;
    if (filterModulo !== "todos") count++;
    if (filterAno !== ANO_ATUAL) count++;
    if (filterDataDe) count++;
    if (filterDataAte) count++;
    if (filterPresenca !== "todos") count++;
    if (encontroManualId) count++;
    return count;
  }, [
    filterNome,
    filterEscola,
    filterModulo,
    filterAno,
    filterDataDe,
    filterDataAte,
    filterPresenca,
    encontroManualId,
  ]);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div>
      <PageHeader
        title="Presença"
        description="Acompanhe a participação dos inscritos nos encontros do curso."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleExport()}
              disabled={!encontroManualId}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Imprimir lista
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQrEncontroId(
                  encontroManualId ||
                    encontrosFiltrados.at(-1)?.id ||
                    encontros[0]?.id ||
                    "",
                );
                setQrOpen(true);
              }}
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="cpae-card border-0 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inscritos</p>
              <p className="text-2xl font-bold tabular-nums">{totais.inscritos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cpae-card border-0 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Listas fechadas no filtro</p>
              <p className="text-2xl font-bold tabular-nums">
                {totais.encontrosRealizados}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {totais.encontros}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="cpae-card border-0 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Presenças registradas</p>
              <p className="text-2xl font-bold tabular-nums">{totais.presencasRegistradas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cpae-card border-0 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Média de participação</p>
              <p className="text-2xl font-bold tabular-nums">{totais.mediaParticipacaoPct}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="cpae-card border-0 shadow-none">
        <CardContent className="space-y-4 pt-6">
          <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 font-medium text-foreground hover:bg-muted/60"
                >
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  Filtros
                  {activeFilterCount > 0 ? (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      filtrosAbertos && "rotate-180",
                    )}
                  />
                  <span className="sr-only">{filtrosAbertos ? "Recolher filtros" : "Expandir filtros"}</span>
                </Button>
              </CollapsibleTrigger>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {filtrosAbertos ? "Recolher" : "Expandir"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasActiveFilters}
                  onClick={clearFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>

            <CollapsibleContent className="space-y-4 pt-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filtrar por nome…"
                value={filterNome}
                onChange={(e) => setFilterNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Escola</Label>
              <Select value={filterEscola} onValueChange={setFilterEscola}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as escolas</SelectItem>
                  {escolasOptions.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Módulo</Label>
              <Select value={filterModulo} onValueChange={setFilterModulo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os módulos</SelectItem>
                  {moduloCursoOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ano (inscritos)</Label>
              <Select value={filterAno} onValueChange={setFilterAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os anos</SelectItem>
                  {anosOptions.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data de</Label>
              <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data até</Label>
              <Input type="date" value={filterDataAte} onChange={(e) => setFilterDataAte(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Situação de presença</Label>
              <Select
                value={filterPresenca}
                onValueChange={(v) => setFilterPresenca(v as PresencaFilter)}
                disabled={!encontroManualId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presencaFilterOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Encontro — registro manual</Label>
                <Select value={encontroManualId || undefined} onValueChange={setEncontroManualId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o encontro para marcar presenças" />
                  </SelectTrigger>
                  <SelectContent>
                    {encontros.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.modulo_curso} · {formatDataBr(e.data)} · {formatHorario(e.horario)} ·{" "}
                        {e.local}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {encontroManual ? (
                <div className="flex flex-wrap items-center gap-2 pb-0.5 text-sm text-muted-foreground">
                  <Badge variant="outline">{encontroManual.modulo_curso}</Badge>
                  {encontroManual.lista_presenca_fechada ? (
                    <Badge variant="secondary">Lista fechada</Badge>
                  ) : null}
                  <span>
                    {savedPresentIds.size} registrados · {draftSelected.size} presentes marcados
                    {hasPendingChanges ? " · alterações pendentes" : ""}
                  </span>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Marque apenas quem compareceu. Ao confirmar a lista, os demais inscritos do ano serão
              registrados como <strong>ausentes</strong> (bolinha vermelha na coluna Encontros).
            </p>
          </div>
            </CollapsibleContent>
          </Collapsible>

          {encontroManualId && duplicateIpsManual.length > 0 ? (
            <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-950">IPs com múltiplos CPFs</AlertTitle>
              <AlertDescription className="text-amber-900/90">
                {duplicateIpsManual.length} endereço(s) IP registraram presença para mais de um CPF
                neste encontro: {duplicateIpsManual.join(", ")}. Use o filtro «Mesmo IP em vários
                CPFs» para revisar.
              </AlertDescription>
            </Alert>
          ) : null}

          {encontroManualId ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                Marcar filtrados
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearFiltered}>
                Desmarcar filtrados
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleExport()}
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                Imprimir lista
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={
                  !encontroManualId ||
                  (presencasEncontroManual.length === 0 && !encontroManual?.lista_presenca_fechada) ||
                  clearEncontroPresencasMut.isPending
                }
                onClick={() => setClearEncontroOpen(true)}
              >
                {clearEncontroPresencasMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Limpar encontro
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!podeConfirmarLista || confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                Confirmar lista
                {hasPendingChanges
                  ? ` (${toAdd.length > 0 ? `+${toAdd.length}` : ""}${
                      toAdd.length && toRemove.length ? " " : ""
                    }${toRemove.length > 0 ? `−${toRemove.length}` : ""})`
                  : ""}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {inscritosFiltrados.length} inscrito(s) · {encontrosFiltrados.length} encontro(s) no
              período
              {encontrosDotsCols.length > 0 ? (
                <span className="ml-1">
                  · coluna «Encontros»:{" "}
                  {encontrosDotsCols.map((e) => e.modulo_curso.replace("Módulo ", "M")).join(" · ")}
                </span>
              ) : null}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5 font-medium">#</th>
                  {encontroManualId ? (
                    <th className="w-14 px-3 py-2.5 font-medium">Presença</th>
                  ) : null}
                  <th className="px-3 py-2.5 font-medium">Participante</th>
                  <th className="px-3 py-2.5 font-medium">Escola</th>
                  <th className="min-w-[180px] px-3 py-2.5 text-center font-medium">Encontros</th>
                  <th className="w-16 px-3 py-2.5 text-center font-medium">%</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium">Presenças</th>
                  {encontroManualId ? (
                    <th className="w-16 px-3 py-2.5 font-medium">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={encontroManualId ? 8 : 6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Carregando…
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={encontroManualId ? 8 : 6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      {filterPresenca === "presentes"
                        ? "Nenhum participante com presença registrada neste encontro."
                        : filterPresenca === "ausentes"
                          ? "Todos os inscritos filtrados já possuem presença registrada."
                          : filterPresenca === "ip_duplicado"
                            ? "Nenhum IP duplicado encontrado neste encontro."
                            : "Nenhum inscrito encontrado com os filtros atuais."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((inscrito, idx) => {
                    const participacao = calcParticipacao(
                      inscrito.id,
                      encontrosFiltrados,
                      presencaSet,
                    );
                    const selected = draftSelected.has(inscrito.id);
                    const saved = savedPresentIds.has(inscrito.id);
                    const presencaManual = presencasEncontroManual.find(
                      (p) => p.inscrito_id === inscrito.id,
                    );
                    const ip = presencaManual?.registrado_ip?.trim() ?? null;
                    const ipDuplicado = ip ? (ipUsageByEncontroManual.get(ip) ?? 0) > 1 : false;

                    return (
                      <tr
                        key={inscrito.id}
                        className={cn(
                          "border-t hover:bg-muted/20",
                          encontroManualId && selected && "bg-emerald-50/40",
                          encontroManualId && selected !== saved && "bg-amber-50/50",
                          encontroManualId && ipDuplicado && "bg-red-50/40",
                        )}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                          {pageStart + idx + 1}
                        </td>
                        {encontroManualId ? (
                          <td className="px-3 py-2.5">
                            <Checkbox
                              checked={selected}
                              disabled={confirmMut.isPending}
                              onCheckedChange={(checked) =>
                                toggleDraft(inscrito.id, checked === true)
                              }
                              aria-label={`Presença de ${inscrito.nome_completo}`}
                            />
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{inscrito.nome_completo}</p>
                          {inscrito.cpf ? (
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {inscrito.cpf}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">
                          {escolaInscritoLabel(inscrito) || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <ParticipacaoEncontrosDots
                            dots={participacao.ultimos}
                            disabled={togglePresencaMut.isPending || !!encontroManualId}
                            onToggle={
                              encontroManualId
                                ? undefined
                                : (encontroId, presente) =>
                                    togglePresencaMut.mutate({
                                      inscritoId: inscrito.id,
                                      encontroId,
                                      presente,
                                      cpf: inscrito.cpf,
                                    })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-block min-w-[2.5rem] font-bold tabular-nums",
                              participacao.pct >= 75 && "text-emerald-600",
                              participacao.pct > 0 && participacao.pct < 50 && "text-red-600",
                              participacao.pct === 0 && "text-muted-foreground",
                            )}
                          >
                            {participacao.pct}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">
                          {participacao.presentes}/{participacao.total}
                        </td>
                        {encontroManualId ? (
                          <td className="px-3 py-2.5">
                            {saved && presencaManual ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletePresencaMut.isPending || confirmMut.isPending}
                                title="Excluir presença"
                                onClick={() =>
                                  setDeleteTarget({
                                    presencaId: presencaManual.id,
                                    nome: inscrito.nome_completo,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {encontroManualId ? (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!podeConfirmarLista || confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Confirmar lista
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Presente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                Ausente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
                Pendente
              </span>
              {!encontroManualId ? (
                <span>· Clique na bolinha para registrar ou remover presença</span>
              ) : (
                <span>
                  · Marque os presentes e confirme a lista — os não marcados ficarão ausentes
                </span>
              )}
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code — presença</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Encontro</Label>
              <Select value={qrEncontroId || undefined} onValueChange={setQrEncontroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o encontro" />
                </SelectTrigger>
                <SelectContent>
                  {encontros.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.modulo_curso} · {formatDataBr(e.data)} · {formatHorario(e.horario)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {qrEncontro ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{qrEncontro.modulo_curso}</Badge>
                  <Badge variant={isRecebimentoPresencaAtivo(qrEncontro) ? "default" : "secondary"}>
                    Recebimento {isRecebimentoPresencaAtivo(qrEncontro) ? "aberto" : "fechado"}
                  </Badge>
                </div>
                <div ref={qrSvgWrapRef} className="mx-auto w-fit rounded-xl bg-white p-4">
                  <QRCode value={qrUrl} size={200} />
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={qrUrl} className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Copiar link"
                    onClick={async () => {
                      await navigator.clipboard.writeText(qrUrl);
                      toast.success("Link copiado.");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    const svg = qrSvgWrapRef.current?.querySelector("svg");
                    if (!svg) {
                      toast.error("QR Code não encontrado.");
                      return;
                    }
                    try {
                      await downloadQrCodePng(
                        svg,
                        buildPresencaQrFilename({
                          modulo_curso: qrEncontro.modulo_curso,
                          data: qrEncontro.data,
                          qr_token: qrEncontro.qr_token,
                        }),
                      );
                      toast.success("Download iniciado.");
                    } catch (e) {
                      toast.error("Erro ao baixar", {
                        description: e instanceof Error ? e.message : undefined,
                      });
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar imagem do QR Code
                </Button>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir presença?</AlertDialogTitle>
            <AlertDialogDescription>
              A presença de <strong>{deleteTarget?.nome}</strong> neste encontro será removida. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePresencaMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePresencaMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget)
                  deletePresencaMut.mutate({
                    presencaId: deleteTarget.presencaId,
                    encontroId: encontroManualId,
                  });
              }}
            >
              {deletePresencaMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                "Excluir presença"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearEncontroOpen} onOpenChange={setClearEncontroOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os registros do encontro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {encontroManual ? (
                  <p>
                    Encontro:{" "}
                    <strong className="text-foreground">
                      {encontroManual.modulo_curso} · {formatDataBr(encontroManual.data)} ·{" "}
                      {formatHorario(encontroManual.horario)}
                    </strong>
                  </p>
                ) : null}
                <p>
                  Serão removidos{" "}
                  <strong className="text-foreground">{presencasEncontroManual.length}</strong>{" "}
                  registro(s) de presença (manual e QR Code). A lista será reaberta e as bolinhas
                  voltarão ao estado pendente (cinza).
                </p>
                <p>Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearEncontroPresencasMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearEncontroPresencasMut.isPending || !encontroManualId}
              onClick={(e) => {
                e.preventDefault();
                if (encontroManualId) clearEncontroPresencasMut.mutate(encontroManualId);
              }}
            >
              {clearEncontroPresencasMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                "Excluir todos os registros"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
