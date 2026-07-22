import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendVivenciaCreatedEmails } from "@/lib/vivencias-notify.server";

const groupSchema = z.object({
  aluno_serie: z.string().min(1),
  aluno_turma: z.string().min(1),
  periodo: z.string().min(1),
  temas: z.array(z.string()),
  data_preferivel: z.string().nullable().optional(),
});

const notificationSchema = z.object({
  requestId: z.string().uuid(),
  numero: z.string().min(1),
  school_nome: z.string().min(1),
  tipo_escola: z.enum(["escola", "emei"]),
  regiao_escola: z.string().nullable(),
  solicitante_email: z.string().email(),
  solicitante_nome: z.string().min(1),
  solicitante_cargo: z.string().min(1),
  solicitante_telefone: z.string().min(1),
  groups: z.array(groupSchema).min(1),
  palestra_tema: z.string().nullable().optional(),
  data_preferivel_palestra: z.string().nullable().optional(),
  alertEmails: z.array(z.string().email()).optional().default([]),
});

/** Envia e-mails de confirmação ao solicitante e notificação aos opt-in de Vivências. */
export const notifyVivenciaCreated = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notificationSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await sendVivenciaCreatedEmails(data);
    return result;
  });
