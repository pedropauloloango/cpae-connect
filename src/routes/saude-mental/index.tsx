import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { submitSaudeMentalInscricao } from "@/lib/saude-mental-submit";
import { loadPublicSchools, publicSchoolsErrorMessage } from "@/lib/public-schools";
import { SchoolSearchSelect } from "@/components/schools/SchoolSearchSelect";
import type { PublicSchoolOption } from "@/lib/public-schools";
import {
  digitsOnly,
  formatCpfMask,
  nivelEscolaridadeOptions,
} from "@/lib/saude-mental-options";
import { SaudeMentalCursoHero } from "@/components/saude-mental/SaudeMentalCursoHero";
import { fetchSaudeMentalInscricaoStatus } from "@/lib/saude-mental-inscricao-config";
import { DalealDeveloperBanner } from "@/components/layout/DalealDeveloperBanner";

export const Route = createFileRoute("/saude-mental/")({
  head: () => ({
    meta: [
      { title: "Curso de Saúde Mental na Educação — CPAE" },
      {
        name: "description",
        content: "Formulário de inscrição no Curso de Saúde Mental na Educação da CPAE.",
      },
    ],
  }),
  component: SaudeMentalPublico,
});

const schema = z.object({
  school_id: z.string().uuid("Selecione a escola ou EMEI em que atua"),
  school_nome: z.string().trim().min(2, "Selecione a escola ou EMEI em que atua"),
  nome_completo: z.string().trim().min(3, "Informe o nome completo"),
  cpf: z
    .string()
    .min(1, "Informe o CPF")
    .refine((v) => digitsOnly(v).length === 11, "Informe um CPF válido com 11 dígitos"),
  data_nascimento: z.string().min(1, "Informe a data de nascimento"),
  telefone_whatsapp: z
    .string()
    .min(1, "Informe o telefone (WhatsApp)")
    .refine((v) => digitsOnly(v).length >= 10, "Informe um telefone válido com DDD"),
  email: z.string().trim().min(1, "Informe o e-mail").email("Informe um e-mail válido"),
  funcao: z.string().trim().min(2, "Informe a função"),
  nivel_escolaridade: z
    .string()
    .min(1, "Selecione o nível de escolaridade")
    .refine(
      (v) => nivelEscolaridadeOptions.some((o) => o.value === v),
      "Selecione o nível de escolaridade",
    ),
});

type FormValues = z.infer<typeof schema>;

const primaryBtn =
  "rounded-[14px] font-semibold text-white transition-all duration-300 ease-in-out shadow-[0_10px_30px_rgba(15,82,186,0.2)] bg-[#0F52BA] hover:bg-[#083D8C]";

const formCard =
  "rounded-[20px] border border-slate-100 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)]";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-50 h-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between gap-4 px-4 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
            <img src="/logo_CPAE.png" alt="CPAE" className="h-12 w-auto object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">CPAE</p>
              <p className="truncate text-xs text-slate-500">Saúde Mental na Educação</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/saude-mental/curso"
              className="hidden text-sm font-medium text-[#0F52BA] hover:underline sm:inline"
            >
              Sobre o curso
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7B2CBF] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Início
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-8 lg:py-10">{children}</main>
      <DalealDeveloperBanner />
      <footer className="mt-2 bg-[#083D8C] px-4 py-6 text-center text-sm text-white/90">
        © {new Date().getFullYear()} CPAE — Coordenadoria Municipal de Psicologia e Assistência
        Educacional
      </footer>
    </div>
  );
}

function SaudeMentalPublico() {
  const [done, setDone] = useState<{ numero: string } | null>(null);

  const inscricaoStatusQuery = useQuery({
    queryKey: ["saude-mental-inscricao-status"],
    queryFn: fetchSaudeMentalInscricaoStatus,
    staleTime: 60_000,
  });

  const schoolsQuery = useQuery({
    queryKey: ["public-schools"],
    queryFn: loadPublicSchools,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      school_id: "",
      school_nome: "",
      nome_completo: "",
      cpf: "",
      data_nascimento: "",
      telefone_whatsapp: "",
      email: "",
      funcao: "",
      nivel_escolaridade: "",
    },
  });

  const mutation = useMutation({
    mutationFn: submitSaudeMentalInscricao,
    onSuccess: (r) => {
      setDone({ numero: r.numero });
      toast.success("Inscrição registrada!");
    },
    onError: (e: Error) => toast.error("Erro ao enviar", { description: e.message }),
  });

  const onSubmit = form.handleSubmit((vals) => {
    mutation.mutate({
      school_id: vals.school_id,
      school_nome: vals.school_nome,
      escola_texto: vals.school_nome,
      nome_completo: vals.nome_completo,
      cpf: vals.cpf,
      data_nascimento: vals.data_nascimento,
      telefone_whatsapp: vals.telefone_whatsapp,
      email: vals.email,
      funcao: vals.funcao,
      nivel_escolaridade: vals.nivel_escolaridade,
    });
  });

  if (done) {
    return (
      <Shell>
        <article className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_60px_rgba(15,82,186,0.08)]">
          <SaudeMentalCursoHero showInfoBar={false} />
          <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-8">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <h1 className="text-2xl font-bold">Inscrição enviada</h1>
            <p className="max-w-md text-slate-600">
              Sua inscrição no Curso de Saúde Mental na Educação foi registrada com o número{" "}
              <strong className="text-[#0F52BA]">{done.numero}</strong>.
            </p>
            <Button asChild className={primaryBtn}>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </article>
      </Shell>
    );
  }

  const inscricaoStatus = inscricaoStatusQuery.data;
  const inscricoesFechadas =
    inscricaoStatusQuery.isSuccess && inscricaoStatus && !inscricaoStatus.aberta;

  if (inscricoesFechadas) {
    return (
      <Shell>
        <article className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_60px_rgba(15,82,186,0.08)]">
          <SaudeMentalCursoHero showInfoBar={false} />
          <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-8">
            <Lock className="h-14 w-14 text-slate-400" />
            <h1 className="text-2xl font-bold">Inscrições encerradas</h1>
            <p className="max-w-md text-slate-600">{inscricaoStatus.mensagem_encerrada}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/saude-mental/curso">Sobre o curso</Link>
              </Button>
              <Button asChild className={primaryBtn}>
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          </div>
        </article>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_60px_rgba(15,82,186,0.08)]">
        <SaudeMentalCursoHero />

        <section className="px-5 py-8 sm:px-8">
          <Card className={formCard}>
            <CardHeader>
              <CardTitle className="text-lg">Inscrição no curso</CardTitle>
              <CardDescription>
                Preencha todos os campos obrigatórios (*). A escola/EMEI deve ser selecionada na
                lista oficial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome completo *</Label>
              <Input
                id="nome_completo"
                required
                {...form.register("nome_completo")}
                placeholder="Seu nome completo"
              />
              {form.formState.errors.nome_completo && (
                <p className="text-xs text-destructive">{form.formState.errors.nome_completo.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Controller
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <Input
                      id="cpf"
                      required
                      value={field.value}
                      onChange={(e) => field.onChange(formatCpfMask(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  )}
                />
                {form.formState.errors.cpf && (
                  <p className="text-xs text-destructive">{form.formState.errors.cpf.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de nascimento *</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  required
                  {...form.register("data_nascimento")}
                />
                {form.formState.errors.data_nascimento && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.data_nascimento.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefone_whatsapp">Telefone (WhatsApp) *</Label>
                <Input
                  id="telefone_whatsapp"
                  required
                  {...form.register("telefone_whatsapp")}
                  placeholder="(67) 99999-9999"
                />
                {form.formState.errors.telefone_whatsapp && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.telefone_whatsapp.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  {...form.register("email")}
                  placeholder="seu@email.com"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>EMEI / Escola em que atua *</Label>
              {schoolsQuery.isError ? (
                <p className="text-sm text-destructive">
                  {publicSchoolsErrorMessage(schoolsQuery.error)}
                </p>
              ) : (
                <SchoolSearchSelect
                  schools={(schoolsQuery.data ?? []) as PublicSchoolOption[]}
                  value={form.watch("school_id") || null}
                  onSelect={(school) => {
                    form.setValue("school_id", school.id, { shouldValidate: true });
                    form.setValue("school_nome", school.nome, { shouldValidate: true });
                  }}
                  loading={schoolsQuery.isLoading}
                  error={
                    schoolsQuery.isError ? publicSchoolsErrorMessage(schoolsQuery.error) : null
                  }
                  onRetry={() => void schoolsQuery.refetch()}
                />
              )}
              {form.formState.errors.school_id && (
                <p className="text-xs text-destructive">{form.formState.errors.school_id.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="funcao">Função *</Label>
                <Input
                  id="funcao"
                  required
                  {...form.register("funcao")}
                  placeholder="Ex.: Professora, Coordenadora…"
                />
                {form.formState.errors.funcao && (
                  <p className="text-xs text-destructive">{form.formState.errors.funcao.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nivel_escolaridade">Nível de escolaridade *</Label>
                <Controller
                  control={form.control}
                  name="nivel_escolaridade"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v)}>
                      <SelectTrigger id="nivel_escolaridade">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {nivelEscolaridadeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.nivel_escolaridade && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nivel_escolaridade.message}
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" className={`w-full ${primaryBtn}`} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Inscrever-se"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
        </section>
      </article>
    </Shell>
  );
}
