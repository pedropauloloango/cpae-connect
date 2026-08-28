import { supabase } from "@/integrations/supabase/client";

export async function resolveActivityActorLabel(
  actorId: string | null | undefined,
): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle();
  const name = data?.full_name?.trim();
  return name || null;
}

export async function insertRequestActivityLog(params: {
  requestId: string;
  action: string;
  details?: Record<string, unknown>;
  actorId?: string | null;
  actorLabel?: string | null;
}) {
  const actor_label =
    params.actorLabel?.trim() ||
    (await resolveActivityActorLabel(params.actorId)) ||
    null;

  const { error } = await supabase.from("activity_logs").insert({
    request_id: params.requestId,
    actor_id: params.actorId ?? null,
    actor_label,
    action: params.action,
    details: params.details ?? {},
  });
  if (error) throw error;
}
