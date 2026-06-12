import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const submissionSchema = z.object({
  school_id: z.string().uuid().nullable(),
  school_nome_snapshot: z.string().min(2).max(200),
  diretor_responsavel: z.string().max(200).optional().nullable(),
  diretor_telefone: z.string().max(50).optional().nullable(),
  aluno_nome: z.string().min(2).max(200),
  aluno_nascimento: z.string().optional().nullable(),
  aluno_serie: z.string().max(50).optional().nullable(),
  aluno_turma: z.string().max(50).optional().nullable(),
  responsavel_nome: z.string().max(200).optional().nullable(),
  responsavel_telefone: z.string().max(50).optional().nullable(),
  tipo_queixa: z.enum([
    "ansiedade_depressao",
    "violacao_direitos",
    "ideacao_suicida",
    "bullying",
    "conflito_familiar",
    "outros",
  ]),
  descricao: z.string().min(10).max(5000),
  attachments: z
    .array(z.object({ filename: z.string(), storage_path: z.string(), mime_type: z.string().optional(), size_bytes: z.number().optional() }))
    .max(5)
    .optional()
    .default([]),
});

export const submitAcolhimento = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submissionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error } = await supabaseAdmin
      .from("requests")
      .insert({
        school_id: data.school_id,
        school_nome_snapshot: data.school_nome_snapshot,
        diretor_responsavel: data.diretor_responsavel,
        diretor_telefone: data.diretor_telefone,
        aluno_nome: data.aluno_nome,
        aluno_nascimento: data.aluno_nascimento || null,
        aluno_serie: data.aluno_serie,
        aluno_turma: data.aluno_turma,
        responsavel_nome: data.responsavel_nome,
        responsavel_telefone: data.responsavel_telefone,
        tipo_queixa: data.tipo_queixa,
        descricao: data.descricao,
        status: "recebida",
      })
      .select("id, numero")
      .single();

    if (error || !req) {
      console.error("submitAcolhimento insert error", error);
      throw new Error("Não foi possível registrar a solicitação. Tente novamente.");
    }

    if (data.attachments && data.attachments.length > 0) {
      await supabaseAdmin.from("attachments").insert(
        data.attachments.map((a) => ({
          request_id: req.id,
          filename: a.filename,
          storage_path: a.storage_path,
          mime_type: a.mime_type ?? null,
          size_bytes: a.size_bytes ?? null,
        })),
      );
    }

    await supabaseAdmin.from("activity_logs").insert({
      request_id: req.id,
      actor_label: "Formulário público",
      action: "solicitacao_criada",
      details: { numero: req.numero, tipo_queixa: data.tipo_queixa },
    });

    return { numero: req.numero, id: req.id };
  });

export const listSchoolsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, nome, regiao")
    .is("deleted_at", null)
    .eq("status", "ativa")
    .order("nome");
  if (error) return [] as { id: string; nome: string; regiao: string | null }[];
  return data ?? [];
});
