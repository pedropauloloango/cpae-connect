import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";
import { meetingNumberLabels, reportStatusCardTone } from "@/lib/labels";
import { MeetingRelatoDownload } from "@/components/meetings/MeetingRelatoDownload";

export const Route = createFileRoute("/_authenticated/aprovacoes")({ component: Aprovacoes });

function Aprovacoes() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, numero, status, data_atendimento, relato_texto, relato_anexo_url, submitted_at, request:requests!inner(id, numero, aluno_nome, school_nome_snapshot), professional:professionals(nome)")
        .eq("status", "aguardando_aprovacao")
        .order("submitted_at", { ascending: true });
      if (error) throw error; return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ meetingId, requestId, decision, comentario }: { meetingId: string; requestId: string; decision: "aprovado" | "rejeitado" | "correcao_solicitada"; comentario?: string }) => {
      const newStatus = decision === "aprovado" ? "aprovado" : decision === "rejeitado" ? "rejeitado" : "correcao_solicitada";
      const { error: e1 } = await supabase.from("meetings").update({ status: newStatus as "aprovado" }).eq("id", meetingId);
      if (e1) throw e1;
      await supabase.from("approvals").insert({ meeting_id: meetingId, reviewer_id: user?.id, decision, comentario });
      if (decision === "aprovado") await supabase.from("requests").update({ status: "em_andamento" }).eq("id", requestId);
      await supabase.from("activity_logs").insert({ request_id: requestId, actor_id: user?.id, action: `aprovacao_${decision}`, details: { meeting_id: meetingId, comentario } });
    },
    onSuccess: () => { toast.success("Decisão registrada"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader title="Aprovações" description="Relatos enviados pelos profissionais aguardando análise." />

      {pending.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Nada pendente. ✨</CardContent></Card>
      )}

      <div className="space-y-4">
        {(pending as unknown as Array<{ id: string; numero: string; data_atendimento: string; relato_texto: string | null; relato_anexo_url: string | null; submitted_at: string; status: string; request: { id: string; numero: string; aluno_nome: string; school_nome_snapshot: string }; professional: { nome: string } | null }>).map((m) => (
          <Card key={m.id} className={`border-l-4 ${reportStatusCardTone[m.status] ?? reportStatusCardTone.aguardando_aprovacao}`}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  <Link to="/demandas/$id" params={{ id: m.request.id }} className="hover:underline">
                    {m.request.aluno_nome} — {meetingNumberLabels[m.numero]}
                  </Link>
                </CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">
                  {m.request.school_nome_snapshot} • Profissional: {m.professional?.nome ?? "—"} • Protocolo {m.request.numero}
                </div>
              </div>
              <MeetingStatusBadge status={m.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">Atendimento: {new Date(m.data_atendimento).toLocaleString("pt-BR")}</div>
              {m.relato_texto && <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{m.relato_texto}</div>}
              {m.relato_anexo_url && <MeetingRelatoDownload storagePath={m.relato_anexo_url} />}
              {!m.relato_texto && !m.relato_anexo_url && (
                <p className="text-sm text-muted-foreground">Relato não informado.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide.mutate({ meetingId: m.id, requestId: m.request.id, decision: "aprovado" })} disabled={decide.isPending}>
                  <Check className="mr-1.5 h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const c = prompt("Comentário (opcional):");
                  if (c === null) return;
                  decide.mutate({ meetingId: m.id, requestId: m.request.id, decision: "correcao_solicitada", comentario: c });
                }} disabled={decide.isPending}>
                  <Edit3 className="mr-1.5 h-4 w-4" /> Solicitar correção
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => {
                  const c = prompt("Motivo da rejeição:");
                  if (c === null || !c.trim()) return;
                  decide.mutate({ meetingId: m.id, requestId: m.request.id, decision: "rejeitado", comentario: c });
                }} disabled={decide.isPending}>
                  <X className="mr-1.5 h-4 w-4" /> Rejeitar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
