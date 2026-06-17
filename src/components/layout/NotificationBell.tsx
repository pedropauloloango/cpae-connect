import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Bell, CheckSquare, Inbox, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchPendingApprovals,
  fetchPendingProfessionalCorrections,
  fetchProfessionalAssignments,
  fetchReceivedRequests,
  PENDING_APPROVALS_QUERY_KEY,
  PENDING_ASSIGNMENTS_QUERY_KEY,
  PENDING_CORRECTIONS_QUERY_KEY,
  PENDING_RECEIVED_REQUESTS_QUERY_KEY,
  type ClosureNotification,
  type ProfessionalAssignmentNotification,
  type ReceivedRequestNotification,
} from "@/lib/pending-approvals";
import { reportStatusLabels, requestStatusLabels, schoolTipoLabels } from "@/lib/labels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ClosureNotificationItem({ item, subtitle }: { item: ClosureNotification; subtitle?: string }) {
  return (
    <Link
      to="/demandas/$id"
      params={{ id: item.request.id }}
      search={{ tab: "encerramento" }}
      className="block border-b border-[#F1F5F9] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#F8FAFC]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0F172A]">{item.request.aluno_nome}</div>
          <div className="mt-0.5 text-xs text-[#64748B]">
            Protocolo {item.request.numero}
            {item.request.school_nome_snapshot ? ` • ${item.request.school_nome_snapshot}` : ""}
          </div>
          {subtitle && <div className="mt-1 text-xs font-medium text-[#B45309]">{subtitle}</div>}
          {item.request.professional?.nome && (
            <div className="mt-0.5 text-xs text-[#94A3B8]">Profissional: {item.request.professional.nome}</div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
          {reportStatusLabels[item.status] ?? item.status}
        </span>
      </div>
    </Link>
  );
}

function formatSchoolDisplay(nome: string | null, tipo: string | null): string {
  if (!nome?.trim()) return "Escola/EMEI não informada";
  const tipoLabel = tipo ? schoolTipoLabels[tipo] : null;
  return tipoLabel ? `${tipoLabel} ${nome}` : nome;
}

function ReceivedRequestNotificationItem({ request }: { request: ReceivedRequestNotification }) {
  const receivedAt = new Date(request.created_at).toLocaleString("pt-BR");

  return (
    <Link
      to="/demandas/$id"
      params={{ id: request.id }}
      search={{ tab: "info" }}
      className="block border-b border-[#F1F5F9] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#F8FAFC]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[#0F172A]">
          {formatSchoolDisplay(request.school_nome_snapshot, request.tipo_escola)}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-[#334155]">{request.aluno_nome}</div>
        <div className="mt-1 text-xs text-[#64748B]">
          Protocolo {request.numero} • {receivedAt}
        </div>
        <span className="mt-2 inline-block rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#0F52BA]">
          {requestStatusLabels[request.status] ?? request.status}
        </span>
      </div>
    </Link>
  );
}

function AssignmentNotificationItem({ request }: { request: ProfessionalAssignmentNotification }) {
  const assignedAt = request.assigned_at
    ? new Date(request.assigned_at).toLocaleString("pt-BR")
    : "—";

  return (
    <Link
      to="/demandas/$id"
      params={{ id: request.id }}
      search={{ tab: "info" }}
      className="block border-b border-[#F1F5F9] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#F8FAFC]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[#0F172A]">
          {formatSchoolDisplay(request.school_nome_snapshot, request.tipo_escola)}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-[#334155]">{request.aluno_nome}</div>
        <div className="mt-1 text-xs text-[#64748B]">
          Protocolo {request.numero} • Atribuída em {assignedAt}
        </div>
        <span className="mt-2 inline-block rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#0F52BA]">
          {requestStatusLabels[request.status] ?? request.status}
        </span>
      </div>
    </Link>
  );
}

function NotificationSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
        {title}
      </div>
      {children}
    </div>
  );
}

export function NotificationBell() {
  const { isAdmin, roles } = useAuth();
  const isProfessional = roles.includes("profissional");

  const { data: pendingApprovals = [], isLoading: loadingApprovals } = useQuery({
    queryKey: PENDING_APPROVALS_QUERY_KEY,
    queryFn: fetchPendingApprovals,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const { data: receivedRequests = [], isLoading: loadingReceived } = useQuery({
    queryKey: PENDING_RECEIVED_REQUESTS_QUERY_KEY,
    queryFn: fetchReceivedRequests,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const { data: pendingCorrections = [], isLoading: loadingCorrections } = useQuery({
    queryKey: PENDING_CORRECTIONS_QUERY_KEY,
    queryFn: fetchPendingProfessionalCorrections,
    enabled: isProfessional && !isAdmin,
    refetchInterval: 60_000,
  });

  const { data: pendingAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: PENDING_ASSIGNMENTS_QUERY_KEY,
    queryFn: fetchProfessionalAssignments,
    enabled: isProfessional && !isAdmin,
    refetchInterval: 60_000,
  });

  if (!isAdmin && !isProfessional) return null;

  const adminCount = receivedRequests.length + pendingApprovals.length;
  const professionalCount = pendingAssignments.length + pendingCorrections.length;
  const count = isAdmin ? adminCount : professionalCount;
  const isLoading = isAdmin
    ? loadingApprovals || loadingReceived
    : loadingCorrections || loadingAssignments;

  const emptyMessage = isAdmin
    ? "Nenhuma notificação pendente."
    : "Nenhuma atribuição ou relatório pendente.";

  const headerDescription = isAdmin
    ? "Novas solicitações e relatórios aguardando análise"
    : "Novas atribuições e relatórios devolvidos para correção";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative rounded-xl border border-white/50 bg-white/40 p-2.5 text-[#0F52BA] shadow-sm transition-all hover:bg-white/80 hover:shadow",
            count > 0 && "ring-2 ring-[#EF4444]/20",
          )}
          aria-label={count > 0 ? `${count} notificações` : "Notificações"}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(100vw-2rem,360px)] rounded-2xl p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-bold text-[#0F172A]">Notificações</div>
          <p className="text-xs text-[#64748B]">{headerDescription}</p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          )}

          {!isLoading && count === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[#64748B]">{emptyMessage}</div>
          )}

          {!isLoading && isAdmin && (
            <>
              {receivedRequests.length > 0 && (
                <NotificationSection title="Solicitações recebidas">
                  {receivedRequests.map((request) => (
                    <ReceivedRequestNotificationItem key={request.id} request={request} />
                  ))}
                </NotificationSection>
              )}
              {pendingApprovals.length > 0 && (
                <NotificationSection title="Aguardando aprovação">
                  {pendingApprovals.map((item) => (
                    <ClosureNotificationItem key={item.id} item={item} />
                  ))}
                </NotificationSection>
              )}
            </>
          )}

          {!isLoading &&
            !isAdmin &&
            (pendingAssignments.length > 0 || pendingCorrections.length > 0) && (
              <>
                {pendingAssignments.length > 0 && (
                  <NotificationSection title="Novas atribuições">
                    {pendingAssignments.map((request) => (
                      <AssignmentNotificationItem key={request.id} request={request} />
                    ))}
                  </NotificationSection>
                )}
                {pendingCorrections.length > 0 && (
                  <NotificationSection title="Relatórios para correção">
                    {pendingCorrections.map((item) => (
                      <ClosureNotificationItem
                        key={item.id}
                        item={item}
                        subtitle={
                          item.status === "rejeitado"
                            ? "Relatório rejeitado — revise e reenvie"
                            : "Correção solicitada — ajuste o relatório consolidado"
                        }
                      />
                    ))}
                  </NotificationSection>
                )}
              </>
            )}
        </div>

        {isAdmin && count > 0 && (
          <div className="space-y-1 border-t p-2">
            {receivedRequests.length > 0 && (
              <Button variant="ghost" className="w-full justify-center gap-2 rounded-xl text-[#0F52BA]" asChild>
                <Link to="/demandas">
                  <Inbox className="h-4 w-4" />
                  Ver demandas recebidas
                </Link>
              </Button>
            )}
            {pendingApprovals.length > 0 && (
              <Button variant="ghost" className="w-full justify-center gap-2 rounded-xl text-[#0F52BA]" asChild>
                <Link to="/aprovacoes">
                  <CheckSquare className="h-4 w-4" />
                  Ver todas as aprovações
                </Link>
              </Button>
            )}
          </div>
        )}

        {!isAdmin && isProfessional && count > 0 && (
          <div className="space-y-1 border-t p-2">
            {pendingAssignments.length > 0 && (
              <Button variant="ghost" className="w-full justify-center gap-2 rounded-xl text-[#0F52BA]" asChild>
                <Link to="/demandas">
                  <UserPlus className="h-4 w-4" />
                  Ver minhas atribuições
                </Link>
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
