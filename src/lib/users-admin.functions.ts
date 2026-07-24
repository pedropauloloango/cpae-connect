import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function deleteUserAdminHandler(actorId: string, targetUserId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (actorId === targetUserId) {
    throw new Error("Você não pode excluir a própria conta.");
  }

  const { data: actorRoles, error: actorRolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", actorId);
  if (actorRolesErr) throw actorRolesErr;

  const actorIsAdmin = (actorRoles ?? []).some(
    (r) => r.role === "admin" || r.role === "super_admin",
  );
  const actorIsSuperAdmin = (actorRoles ?? []).some((r) => r.role === "super_admin");
  if (!actorIsAdmin) {
    throw new Error("Apenas administradores podem excluir usuários.");
  }

  const { data: targetRoles, error: targetRolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId);
  if (targetRolesErr) throw targetRolesErr;

  const targetIsSuperAdmin = (targetRoles ?? []).some((r) => r.role === "super_admin");
  if (targetIsSuperAdmin && !actorIsSuperAdmin) {
    throw new Error("Não é permitido excluir o Super Administrador.");
  }

  const { error: unlinkErr } = await supabaseAdmin
    .from("professionals")
    .update({ user_id: null })
    .eq("user_id", targetUserId);
  if (unlinkErr) throw unlinkErr;

  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (deleteErr) {
    throw new Error(deleteErr.message || "Falha ao excluir usuário no Auth.");
  }
}

/** Exclui usuário do Auth (e profiles/roles em cascata). Requer admin autenticado. */
export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await deleteUserAdminHandler(context.userId, data.userId);
    return { ok: true as const };
  });
