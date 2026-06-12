import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Upload, CheckCircle2, ArrowLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitAcolhimento, listSchoolsPublic } from "@/lib/acolhimento.functions";
import { complaintTypeLabels } from "@/lib/labels";

export const Route = createFileRoute("/acolhimento")({
  head: () => ({
    meta: [
      { title: "Solicitar Acolhimento — CPAE" },
      { name: "description", content: "Formulário público para solicitação de acolhimento da CPAE." },
    ],
  }),
  component: AcolhimentoPublico,
});

const schema = z.object({
  school_id: z.string().min(1, "Selecione a escola"),
  diretor_responsavel: z.string().optional(),
  diretor_telefone: z.string().optional(),
  aluno_nome: z.string().min(2, "Informe o nome do aluno"),
  aluno_nascimento: z.string().optional(),
  aluno_serie: z.string().optional(),
  aluno_turma: z.string().optional(),
  responsavel_nome: z.string().optional(),
  responsavel_telefone: z.string().optional(),
  tipo_queixa: z.enum(["ansiedade_depressao", "violacao_direitos", "ideacao_suicida", "bullying", "conflito_familiar", "outros"]),
  descricao: z.string().min(10, "Descreva com pelo menos 10 caracteres"),
});

type FormValues = z.infer<typeof schema>;

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

function AcolhimentoPublico() {
  const navigate = useNavigate();
  const submit = useServerFn(submitAcolhimento);
  const listSchools = useServerFn(listSchoolsPublic);
  const [files, setFiles] = useState<File[]>([]);
  const [successNumero, setSuccessNumero] = useState<string | null>(null);

  const { data: schools = [] } = useQuery({ queryKey: ["public-schools"], queryFn: () => listSchools() });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo_queixa: "outros" } as Partial<FormValues> as FormValues,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const uploaded: { filename: string; storage_path: string; mime_type?: string; size_bytes?: number }[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `public/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("acolhimento-anexos").upload(path, file, { contentType: file.type });
        if (error) throw new Error("Falha no upload do anexo: " + error.message);
        uploaded.push({ filename: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size });
      }
      const school = schools.find((s) => s.id === values.school_id);
      return submit({
        data: {
          school_id: values.school_id,
          school_nome_snapshot: school?.nome ?? "Escola não identificada",
          diretor_responsavel: values.diretor_responsavel || null,
          diretor_telefone: values.diretor_telefone || null,
          aluno_nome: values.aluno_nome,
          aluno_nascimento: values.aluno_nascimento || null,
          aluno_serie: values.aluno_serie || null,
          aluno_turma: values.aluno_turma || null,
          responsavel_nome: values.responsavel_nome || null,
          responsavel_telefone: values.responsavel_telefone || null,
          tipo_queixa: values.tipo_queixa,
          descricao: values.descricao,
          attachments: uploaded,
        },
      });
    },
    onSuccess: (data) => {
      setSuccessNumero(data.numero);
      toast.success("Solicitação registrada!");
    },
    onError: (err: Error) => toast.error("Erro ao enviar", { description: err.message }),
  });

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of list) {
      if (!ALLOWED.includes(f.type)) { toast.error(`Tipo não permitido: ${f.name}`); continue; }
      if (f.size > MAX_SIZE) { toast.error(`Arquivo grande demais: ${f.name}`); continue; }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  };

  if (successNumero) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-success/10 p-4">
        <Card className="w-full max-w-lg shadow-elegant">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="mt-4">Solicitação registrada</CardTitle>
            <CardDescription>Guarde o número de protocolo para acompanhamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary-soft py-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</div>
              <div className="mt-1 font-mono text-2xl font-bold text-primary">{successNumero}</div>
            </div>
            <p className="text-sm text-muted-foreground">
              A equipe da CPAE foi notificada e entrará em contato.
            </p>
            <Button onClick={() => navigate({ to: "/" })} className="w-full">Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Início
          </Link>
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="CPAE" className="h-7 w-7 rounded" />
            <span className="text-sm font-semibold">CPAE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Solicitação de Acolhimento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preencha os dados abaixo. Suas informações são tratadas com sigilo pela equipe da CPAE.
          </p>
        </div>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Escola</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Escola *</Label>
                <Select onValueChange={(v) => form.setValue("school_id", v)} value={form.watch("school_id")}>
                  <SelectTrigger><SelectValue placeholder="Selecione a escola" /></SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}{s.regiao ? ` — ${s.regiao}` : ""}</SelectItem>))}
                  </SelectContent>
                </Select>
                {form.formState.errors.school_id && <p className="text-xs text-destructive">{form.formState.errors.school_id.message}</p>}
              </div>
              <div className="space-y-1.5"><Label>Diretor responsável</Label><Input {...form.register("diretor_responsavel")} /></div>
              <div className="space-y-1.5"><Label>Telefone do diretor</Label><Input {...form.register("diretor_telefone")} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Aluno</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5"><Label>Nome do aluno *</Label><Input {...form.register("aluno_nome")} />
                {form.formState.errors.aluno_nome && <p className="text-xs text-destructive">{form.formState.errors.aluno_nome.message}</p>}
              </div>
              <div className="space-y-1.5"><Label>Data de nascimento</Label><Input type="date" {...form.register("aluno_nascimento")} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Série</Label><Input {...form.register("aluno_serie")} /></div>
                <div className="space-y-1.5"><Label>Turma</Label><Input {...form.register("aluno_turma")} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Responsável</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Nome do responsável</Label><Input {...form.register("responsavel_nome")} /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input {...form.register("responsavel_telefone")} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Queixa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo de queixa *</Label>
                <Select onValueChange={(v) => form.setValue("tipo_queixa", v as FormValues["tipo_queixa"])} value={form.watch("tipo_queixa")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(complaintTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição *</Label>
                <Textarea rows={6} {...form.register("descricao")} placeholder="Descreva a situação com o máximo de detalhes possível." />
                {form.formState.errors.descricao && <p className="text-xs text-destructive">{form.formState.errors.descricao.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Anexos (PDF, JPG, PNG — até 5 arquivos, 10MB cada)</Label>
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs">
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {files.length < MAX_FILES && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-card px-4 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" /> Adicionar arquivo
                    <input type="file" accept=".pdf,image/jpeg,image/png" multiple className="hidden" onChange={onFiles} />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitação
          </Button>
        </form>
      </main>
    </div>
  );
}
