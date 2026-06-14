import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchUsersAdmin, type AdminUserRow } from "@/lib/users-admin";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, UserCheck, UserX, Shield, Briefcase } from "lucide-react";
import { accountStatusLabels, accountStatusTone, appRoleLabels } from "@/lib/labels";
import type { AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({ component: UsuariosConfig });

type UserRow = AdminUserRow;

function UsuariosConfig() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [filterTouched, setFilterTouched] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [role, setRole] = useState<AppRole>("profissional");
  const [professionalId, setProfessionalId] = useState<string>("");

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ["config-users"],
    queryFn: fetchUsersAdmin,
    retry: 1,
  });
  const pendingCount = users.filter((u) => u.account_status === "pendente").length;

  useEffect(() => {
    if (!filterTouched && pendingCount > 0 && filter === "todos") {
      setFilter("pendente");
    }
  }, [pendingCount, filter, filterTouched]);

  const { data: availablePros = [] } = useQuery({
    queryKey: ["config-professionals-unlinked", editing?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome, user_id")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter(
        (p: { user_id: string | null }) => !p.user_id || p.user_id === editing?.id,
      ) as { id: string; nome: string }[];
    },
    enabled: !!editing,
  });

  const saveMut = useMutation({
    mutationFn: async ({
      userId,
      newRole,
      proId,
      approve,
    }: {
      userId: string;
      newRole: AppRole;
      proId: string | null;
      approve: boolean;
    }) => {
      if (approve && newRole === "profissional" && !proId) {
        throw new Error("Selecione o cadastro de profissional para vincular.");
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ account_status: approve ? "aprovado" : "rejeitado" })
        .eq("id", userId);
      if (profileErr) throw profileErr;

      const { error: delRolesErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delRolesErr) throw delRolesErr;

      const { data: linkedPros } = await supabase.from("professionals").select("id").eq("user_id", userId);
      if (linkedPros?.length) {
        const { error: unlinkErr } = await supabase.from("professionals").update({ user_id: null }).eq("user_id", userId);
        if (unlinkErr) throw unlinkErr;
      }

      if (approve) {
        const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        if (roleErr) throw roleErr;

        if (newRole === "profissional" && proId) {
          const { error: linkErr } = await supabase.from("professionals").update({ user_id: userId }).eq("id", proId);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      qc.invalidateQueries({ queryKey: ["config-users"] });
      qc.invalidateQueries({ queryKey: ["professionals"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setRole(row.roles[0] ?? "profissional");
    setProfessionalId(row.professional?.id ?? "");
  };

  const filtered = users.filter((u) => {
    if (filter !== "todos" && u.account_status !== filter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s)
    );
  });

  const hiddenPendingCount = pendingCount - filtered.filter((u) => u.account_status === "pendente").length;

  return (
    <div>
      <PageHeader
        title="Módulo Usuários"
        description="Aprove cadastros e vincule permissões de Administrador ou Profissional."
        actions={
          pendingCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-warning/40 bg-warning/10 text-warning-foreground hover:bg-warning/15"
              onClick={() => {
                setFilter("pendente");
                setFilterTouched(true);
                setQ("");
              }}
            >
              {pendingCount} aguardando aprovação
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="pl-9"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v);
              setFilterTouched(true);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Aguardando aprovação</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError && (
        <Card className="mb-4 border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && pendingCount > 0 && hiddenPendingCount > 0 && filter !== "pendente" && (
        <Card className="mb-4 border-warning/30 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>
              Existem <strong>{hiddenPendingCount}</strong> cadastro(s) aguardando aprovação oculto(s) pelo filtro atual.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setFilter("pendente");
                setFilterTouched(true);
                setQ("");
              }}
            >
              Mostrar aguardando aprovação
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Permissão</th>
                  <th className="px-4 py-3">Profissional vinculado</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {users.length === 0
                        ? "Nenhum usuário cadastrado."
                        : pendingCount > 0 && filter !== "pendente"
                          ? "Nenhum usuário com este filtro. Há cadastros aguardando aprovação."
                          : "Nenhum usuário encontrado."}
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={accountStatusTone[u.account_status]}>
                        {accountStatusLabels[u.account_status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="mr-1">
                            {appRoleLabels[r]}
                          </Badge>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.professional?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Badge variant="outline" className={accountStatusTone[u.account_status]}>
                    {accountStatusLabels[u.account_status]}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => openEdit(u)}>
                  Gerenciar permissões
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="font-medium">{editing.full_name || "Sem nome"}</div>
                <div className="text-muted-foreground">{editing.email}</div>
              </div>

              <div className="space-y-1.5">
                <Label>Permissão</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Administrador</span>
                    </SelectItem>
                    <SelectItem value="profissional">
                      <span className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5" /> Profissional</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === "profissional" && (
                <div className="space-y-1.5">
                  <Label>Vincular ao cadastro de profissional *</Label>
                  <Select value={professionalId} onValueChange={setProfessionalId}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {availablePros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availablePros.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre profissionais em Escolas → Profissionais antes de vincular.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() =>
                    saveMut.mutate({
                      userId: editing.id,
                      newRole: role,
                      proId: role === "profissional" ? professionalId || null : null,
                      approve: true,
                    })
                  }
                  disabled={saveMut.isPending || editing.id === currentUser?.id}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:bg-destructive/10"
                  onClick={() => saveMut.mutate({ userId: editing.id, newRole: role, proId: null, approve: false })}
                  disabled={saveMut.isPending || editing.id === currentUser?.id}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Rejeitar
                </Button>
              </div>
              {editing.id === currentUser?.id && (
                <p className="text-xs text-muted-foreground">Você não pode alterar suas próprias permissões.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
