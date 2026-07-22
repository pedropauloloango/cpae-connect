import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendAcolhimentoCreatedEmails } from "@/lib/acolhimento-notify.server";

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
  modalidade_acolhimento: z.string().min(1),
  aluno_nome: z.string().min(1),
  aluno_nascimento: z.string().min(1),
  aluno_sexo: z.string().min(1),
  educacao_especial: z.boolean(),
  aluno_serie: z.string().min(1),
  aluno_turma: z.string().min(1),
  aluno_turma_ano: z.string().min(1),
  periodo: z.string().min(1),
  comunicou_abuso: z.array(z.string()),
  situacao_observada: z.array(z.string()),
  acolhido_anteriormente: z.boolean(),
  autorizacao_ata: z.string().min(1),
  tipo_queixa: z.string().min(1),
  alertEmails: z.array(z.string().email()).optional().default([]),
});

/** Envia e-mails de confirmação ao solicitante e notificação aos opt-in de Acolhimento. */
export const notifyAcolhimentoCreated = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notificationSchema.parse(d))
  .handler(async ({ data }) => {
    const result = await sendAcolhimentoCreatedEmails(data);
    return result;
  });
