import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  computeInscricaoAberta,
  DEFAULT_MENSAGEM_ENCERRADA,
  fetchSaudeMentalInscricaoConfig,
  formatEncerramentoBr,
  fromDatetimeLocalValue,
  inscricaoFechadaMotivo,
  toDatetimeLocalValue,
  updateSaudeMentalInscricaoConfig,
} from "@/lib/saude-mental-inscricao-config";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/inscricoes-periodo")({
  component: SaudeMentalInscricoesPeriodoPage,
});

function SaudeMentalInscricoesPeriodoPage() {
  const qc = useQueryClient();
  const [habilitadas, setHabilitadas] = useState(true);
  const [encerramentoLocal, setEncerramentoLocal] = useState("");
  const [mensagem, setMensagem] = useState(DEFAULT_MENSAGEM_ENCERRADA);

  const configQuery = useQuery({
    queryKey: ["saude-mental-inscricao-config"],
    queryFn: fetchSaudeMentalInscricaoConfig,
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setHabilitadas(configQuery.data.inscricoes_habilitadas);
    setEncerramentoLocal(toDatetimeLocalValue(configQuery.data.encerramento_em));
    setMensagem(configQuery.data.mensagem_encerrada);
  }, [configQuery.data]);

  const previewAberta = computeInscricaoAberta({
    inscricoes_habilitadas: habilitadas,
    encerramento_em: fromDatetimeLocalValue(encerramentoLocal),
  });

  const previewStatus = {
    aberta: previewAberta,
    inscricoes_habilitadas: habilitadas,
    encerramento_em: fromDatetimeLocalValue(encerramentoLocal),
    mensagem_encerrada: mensagem.trim() || DEFAULT_MENSAGEM_ENCERRADA,
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSaudeMentalInscricaoConfig({
        inscricoes_habilitadas: habilitadas,
        encerramento_em: fromDatetimeLocalValue(encerramentoLocal),
        mensagem_encerrada: mensagem,
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscricao-config"] });
      void qc.invalidateQueries({ queryKey: ["saude-mental-inscricao-status"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const encerramentoIso = fromDatetimeLocalValue(encerramentoLocal);
  const encerramentoLabel = formatEncerramentoBr(encerramentoIso);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Período de inscrições"
        description="Controle quando o botão «Inscreva-se agora!» e o formulário público ficam disponíveis."
      />

      {configQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando configuração…
        </div>
      ) : configQuery.isError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {(configQuery.error as Error).message}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
              <CardDescription>
                Desative manualmente ou defina uma data limite. Após o prazo, novas inscrições pelo
                site são bloqueadas automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="inscricoes-habilitadas">Aceitar novas inscrições</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desligado, o formulário público fica indisponível imediatamente.
                  </p>
                </div>
                <Switch
                  id="inscricoes-habilitadas"
                  checked={habilitadas}
                  onCheckedChange={setHabilitadas}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="encerramento-em">Encerrar automaticamente em (opcional)</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="encerramento-em"
                    type="datetime-local"
                    value={encerramentoLocal}
                    onChange={(e) => setEncerramentoLocal(e.target.value)}
                    className="sm:max-w-xs"
                  />
                  {encerramentoLocal ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEncerramentoLocal("")}
                    >
                      Remover data
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para não usar prazo automático. Horário conforme o fuso do
                  navegador.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem-encerrada">Mensagem quando encerrado</Label>
                <Textarea
                  id="mensagem-encerrada"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={3}
                  placeholder={DEFAULT_MENSAGEM_ENCERRADA}
                />
                <p className="text-xs text-muted-foreground">
                  Exibida no flyer do curso e na página de inscrição quando as vagas estiverem
                  fechadas.
                </p>
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  "Salvar configuração"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situação atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Pré-visualização:</span>
                <Badge variant={previewAberta ? "default" : "secondary"}>
                  {previewAberta ? "Inscrições abertas" : "Inscrições encerradas"}
                </Badge>
              </div>

              {!previewAberta ? (
                <p className="text-sm text-muted-foreground">
                  {inscricaoFechadaMotivo(previewStatus)}
                </p>
              ) : encerramentoLabel ? (
                <p className="text-sm text-muted-foreground">
                  Encerramento programado para {encerramentoLabel}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sem data limite definida.</p>
              )}

              {configQuery.data?.updated_at ? (
                <p className="border-t pt-4 text-xs text-muted-foreground">
                  Última alteração:{" "}
                  {new Date(configQuery.data.updated_at).toLocaleString("pt-BR")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
