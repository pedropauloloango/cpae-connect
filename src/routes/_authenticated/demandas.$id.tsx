import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/AppShell";
import { complaintTypeLabels, requestStatusLabels, requestStatusTone, meetingNumberLabels, reportStatusLabels, closureResultLabels } from "@/lib/labels";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Send, Check, X, Clock, FileText, MessageSquare, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demandas/$id")({ component: DemandaDetail });

function DemandaDetail() {
  const { id } = useParams({ from: "/_authenticated/demandas/$id" });
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();

  const { data: req } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, school:schools(*), professional:professionals!assigned_professional_id(*)")
        .eq("id", id).single();
      if (error) throw error; return data;
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", id],
    queryFn: async () => {
      const { data } = await supabase.from("meetings").select("*").eq("request_id", id).order("created_at");
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs", id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").eq("request_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: closure } = useQuery({
    queryKey: ["closure", id],
    queryFn: async () => {
      const { data } = await supabase.from("case_closures").select("*").eq("request_id", id).maybeSingle();
      return data;
    },
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-active"],
    queryFn: async () => {
      const { data } = await supabase.from("professionals").select("id, nome").eq("status", "ativo").is("deleted_at", null).order("nome");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const assignMut = useMutation({
    mutationFn: async (professional_id: string) => {
      const { error } = await supabase.from("requests").update({
        assigned_professional_id: professional_id, assigned_at: new Date().toISOString(),
        assigned_by: user?.id, status: "distribuida",
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({ request_id: id, actor_id: user?.id, action: "atribuicao", details: { professional_id } });
    },
    onSuccess: () => { toast.success("Profissional atribuído."); qc.invalidateQueries({ queryKey: ["request", id] }); qc.invalidateQueries({ queryKey: ["logs", id] }); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <Link to="/demandas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageHeader
        title={req?.aluno_nome ?? "Demanda"}
        description={req ? `Protocolo ${req.numero} • ${complaintTypeLabels[req.tipo_queixa]}` : ""}
        actions={req && <Badge variant="outline" className={`${requestStatusTone[req.status]} text-xs`}>{requestStatusLabels[req.status]}</Badge>}
      />

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="encontros">Encontros</TabsTrigger>
          <TabsTrigger value="encerramento">Encerramento</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <Field label="Aluno" value={req?.aluno_nome} />
              <Field label="Data de nascimento" value={req?.aluno_nascimento ? new Date(req.aluno_nascimento).toLocaleDateString("pt-BR") : "—"} />
              <Field label="Série / Turma" value={`${req?.aluno_serie ?? "—"} / ${req?.aluno_turma ?? "—"}`} />
              <Field label="Escola" value={req?.school_nome_snapshot} />
              <Field label="Região" value={req?.school?.regiao ?? "—"} />
              <Field label="Diretor" value={req?.diretor_responsavel ?? "—"} />
              <Field label="Responsável" value={req?.responsavel_nome ?? "—"} />
              <Field label="Telefone do responsável" value={req?.responsavel_telefone ?? "—"} />
              <div className="sm:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</Label>
                <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3">{req?.descricao}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Atribuição</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Profissional atual</div>
                <div className="mt-1 font-medium">{req?.professional?.nome ?? <span className="text-muted-foreground">Não atribuído</span>}</div>
              </div>
              {isAdmin && (
                <div className="space-y-2 border-t pt-3">
                  <Label>Atribuir / reatribuir</Label>
                  <Select onValueChange={(v) => assignMut.mutate(v)} disabled={assignMut.isPending}>
                    <SelectTrigger><SelectValue placeholder="Escolher profissional…" /></SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encontros">
          <EncontrosTab requestId={id} meetings={meetings} professionalId={req?.assigned_professional_id ?? null} />
        </TabsContent>

        <TabsContent value="encerramento">
          <EncerramentoTab requestId={id} closure={closure} />
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
              <ol className="space-y-4">
                {(logs as unknown as Array<{ id: string; action: string; actor_label: string | null; created_at: string; details: Record<string, unknown> | null }>).map((l) => (
                  <li key={l.id} className="flex gap-3">
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 border-l-2 border-border pl-4 pb-2">
                      <div className="text-sm font-medium">{actionLabel(l.action)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")} • {l.actor_label ?? "Sistema"}</div>
                      {l.details && Object.keys(l.details).length > 0 && (
                        <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 text-[11px]">{JSON.stringify(l.details, null, 2)}</pre>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function actionLabel(a: string) {
  return ({
    solicitacao_criada: "Solicitação criada",
    atribuicao: "Profissional atribuído",
    encontro_registrado: "Encontro registrado",
    encontro_enviado_aprovacao: "Encontro enviado para aprovação",
    aprovacao_aprovado: "Relato aprovado",
    aprovacao_rejeitado: "Relato rejeitado",
    aprovacao_correcao_solicitada: "Correção solicitada",
    caso_encerrado: "Caso encerrado",
  } as Record<string, string>)[a] ?? a;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

function EncontrosTab({ requestId, meetings, professionalId }: { requestId: string; meetings: Array<Record<string, unknown>>; professionalId: string | null }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [openForm, setOpenForm] = useState(false);
  const used = new Set(meetings.map((m) => m.numero as string));
  const next = (["primeiro", "segundo", "terceiro"] as const).find((n) => !used.has(n));

  const createMut = useMutation({
    mutationFn: async (vals: { numero: string; tipo: string; data_atendimento: string; relato_texto: string; observacoes: string }) => {
      const { error } = await supabase.from("meetings").insert({
        request_id: requestId, professional_id: professionalId,
        numero: vals.numero as "primeiro" | "segundo" | "terceiro",
        tipo: vals.tipo as "acolhimento", data_atendimento: vals.data_atendimento,
        relato_texto: vals.relato_texto, observacoes: vals.observacoes, status: "rascunho",
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({ request_id: requestId, actor_id: user?.id, action: "encontro_registrado", details: { numero: vals.numero } });
    },
    onSuccess: () => { toast.success("Encontro registrado."); qc.invalidateQueries({ queryKey: ["meetings", requestId] }); qc.invalidateQueries({ queryKey: ["logs", requestId] }); setOpenForm(false); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const sendMut = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.from("meetings").update({ status: "aguardando_aprovacao", submitted_at: new Date().toISOString() }).eq("id", meetingId);
      if (error) throw error;
      await supabase.from("requests").update({ status: "aguardando_aprovacao" }).eq("id", requestId);
      await supabase.from("activity_logs").insert({ request_id: requestId, actor_id: user?.id, action: "encontro_enviado_aprovacao", details: { meeting_id: meetingId } });
    },
    onSuccess: () => { toast.success("Enviado para aprovação."); qc.invalidateQueries({ queryKey: ["meetings", requestId] }); qc.invalidateQueries({ queryKey: ["request", requestId] }); qc.invalidateQueries({ queryKey: ["logs", requestId] }); },
  });

  return (
    <div className="space-y-4">
      {meetings.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum encontro registrado ainda.</CardContent></Card>}

      {meetings.map((m) => {
        const meeting = m as { id: string; numero: string; status: string; data_atendimento: string; relato_texto: string | null; observacoes: string | null };
        return (
          <Card key={meeting.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {meetingNumberLabels[meeting.numero]}</CardTitle>
              <Badge variant="outline">{reportStatusLabels[meeting.status]}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-muted-foreground">{new Date(meeting.data_atendimento).toLocaleString("pt-BR")}</div>
              {meeting.relato_texto && <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{meeting.relato_texto}</div>}
              {meeting.observacoes && <div className="text-xs text-muted-foreground">Obs: {meeting.observacoes}</div>}
              {meeting.status === "rascunho" && (
                <Button size="sm" onClick={() => sendMut.mutate(meeting.id)} disabled={sendMut.isPending}>
                  <Send className="mr-2 h-3.5 w-3.5" /> Enviar para Aprovação
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {next && !openForm && (
        <Button onClick={() => setOpenForm(true)} variant="outline" className="w-full">
          <FileText className="mr-2 h-4 w-4" /> Registrar {meetingNumberLabels[next]}
        </Button>
      )}

      {next && openForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Registrar {meetingNumberLabels[next]}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createMut.mutate({
                  numero: next,
                  tipo: String(f.get("tipo") ?? "acolhimento"),
                  data_atendimento: String(f.get("data")),
                  relato_texto: String(f.get("relato")),
                  observacoes: String(f.get("obs") ?? ""),
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Data do atendimento *</Label><Input name="data" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select name="tipo" defaultValue="acolhimento">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acolhimento">Acolhimento</SelectItem>
                      <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Relato *</Label><Textarea name="relato" rows={6} required /></div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea name="obs" rows={2} /></div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMut.isPending}>Salvar como rascunho</Button>
                <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>Cancelar</Button>
              </div>
              {!isAdmin && !professionalId && <p className="text-xs text-warning-foreground">Esta demanda ainda não está atribuída a um profissional.</p>}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EncerramentoTab({ requestId, closure }: { requestId: string; closure: Record<string, unknown> | null | undefined }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const c = closure as null | { classificacao_final: string; parecer_final: string; resultado: string };

  const closeMut = useMutation({
    mutationFn: async (vals: { classificacao_final: string; parecer_final: string; resultado: string }) => {
      const { error } = await supabase.from("case_closures").insert({
        request_id: requestId,
        classificacao_final: vals.classificacao_final as "ansiedade_depressao",
        parecer_final: vals.parecer_final,
        resultado: vals.resultado as "resolvido",
        closed_by: user?.id,
      });
      if (error) throw error;
      await supabase.from("requests").update({ status: "concluida" }).eq("id", requestId);
      await supabase.from("activity_logs").insert({ request_id: requestId, actor_id: user?.id, action: "caso_encerrado", details: vals });
    },
    onSuccess: () => { toast.success("Caso encerrado."); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (c) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Caso encerrado</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Classificação final" value={complaintTypeLabels[c.classificacao_final]} />
          <Field label="Resultado" value={closureResultLabels[c.resultado]} />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Parecer final</div>
            <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3">{c.parecer_final}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Somente administradores podem encerrar casos.</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Encerrar caso</CardTitle></CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            closeMut.mutate({
              classificacao_final: String(f.get("classificacao")),
              parecer_final: String(f.get("parecer")),
              resultado: String(f.get("resultado")),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Classificação final *</Label>
              <Select name="classificacao" required>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(complaintTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resultado *</Label>
              <Select name="resultado" required>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(closureResultLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Parecer final *</Label><Textarea name="parecer" rows={6} required /></div>
          <Button type="submit" disabled={closeMut.isPending}><Check className="mr-2 h-4 w-4" /> Encerrar caso</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export { X };
