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
import { MeetingRelatoDownload } from "@/components/meetings/MeetingRelatoDownload";
import { fetchPendingApprovals, PENDING_APPROVALS_QUERY_KEY } from "@/lib/pending-approvals";
import { complaintTypeLabels, closureResultLabels, reportStatusCardTone } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/aprovacoes")({ component: Aprovacoes });

function Aprovacoes() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: pending = [] } = useQuery({
    queryKey: PENDING_APPROVALS_QUERY_KEY,
    queryFn: fetchPendingApprovals,
  });

  const decide = useMutation({
    mutationFn: async ({
      closureId,
      requestId,
      decision,
      comentario,
      relatoTexto,
    }: {
      closureId: string;
      requestId: string;
      decision: "aprovado" | "rejeitado" | "correcao_solicitada";
      comentario?: string;
      relatoTexto: string | null;
    }) => {
      const newStatus =
        decision === "aprovado" ? "aprovado" : decision === "rejeitado" ? "rejeitado" : "correcao_solicitada";
      const { error: e1 } = await supabase
        .from("case_closures")
        .update({
          status: newStatus,
          ...(decision === "aprovado" ? { parecer_final: relatoTexto } : {}),
        })
        .eq("id", closureId);
      if (e1) throw e1;
      await supabase.from("approvals").insert({
        closure_id: closureId,
        reviewer_id: user?.id,
        decision,
        comentario,
      });
      if (decision === "aprovado") {
        await supabase.from("requests").update({ status: "concluida" }).eq("id", requestId);
      } else {
        await supabase.from("requests").update({ status: "em_ajuste" }).eq("id", requestId);
      }
      await supabase.from("activity_logs").insert({
        request_id: requestId,
        actor_id: user?.id,
        action: `aprovacao_relatorio_${decision}`,
        details: { closure_id: closureId, comentario },
      });
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Aprovações"
        description="Relatórios consolidados enviados pelos profissionais aguardando análise."
      />

      {pending.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Nada pendente. ✨</CardContent></Card>
      )}

      <div className="space-y-4">
        {pending.map((c) => (
          <Card
            key={c.id}
            className={`border-l-4 ${reportStatusCardTone[c.status] ?? reportStatusCardTone.aguardando_aprovacao}`}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  <Link to="/demandas/$id" params={{ id: c.request.id }} className="hover:underline">
                    {c.request.aluno_nome} — Relatório circunstanciado
                  </Link>
                </CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.request.school_nome_snapshot ?? "—"} • Profissional: {c.request.professional?.nome ?? "—"} •
                  Protocolo {c.request.numero}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {complaintTypeLabels[c.classificacao_final]} • {closureResultLabels[c.resultado]}
                </div>
              </div>
              <MeetingStatusBadge status={c.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              {c.submitted_at && (
                <div className="text-xs text-muted-foreground">
                  Enviado em: {new Date(c.submitted_at).toLocaleString("pt-BR")}
                </div>
              )}
              {c.relato_texto && (
                <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{c.relato_texto}</div>
              )}
              {c.relato_anexo_url && <MeetingRelatoDownload storagePath={c.relato_anexo_url} />}
              {!c.relato_texto && !c.relato_anexo_url && (
                <p className="text-sm text-muted-foreground">Relato não informado.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    decide.mutate({
                      closureId: c.id,
                      requestId: c.request.id,
                      decision: "aprovado",
                      relatoTexto: c.relato_texto,
                    })
                  }
                  disabled={decide.isPending}
                >
                  <Check className="mr-1.5 h-4 w-4" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const comment = prompt("Comentário (opcional):");
                    if (comment === null) return;
                    decide.mutate({
                      closureId: c.id,
                      requestId: c.request.id,
                      decision: "correcao_solicitada",
                      comentario: comment,
                      relatoTexto: c.relato_texto,
                    });
                  }}
                  disabled={decide.isPending}
                >
                  <Edit3 className="mr-1.5 h-4 w-4" /> Solicitar correção
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const comment = prompt("Motivo da rejeição:");
                    if (comment === null || !comment.trim()) return;
                    decide.mutate({
                      closureId: c.id,
                      requestId: c.request.id,
                      decision: "rejeitado",
                      comentario: comment,
                      relatoTexto: c.relato_texto,
                    });
                  }}
                  disabled={decide.isPending}
                >
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
