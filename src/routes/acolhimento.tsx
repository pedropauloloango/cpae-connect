import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2, ArrowLeft, Loader2, Shield, HeartHandshake, School, GraduationCap, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitAcolhimentoRequest } from "@/lib/acolhimento-submit";
import { schoolTipoLabels } from "@/lib/labels";
import { SchoolSearchSelect, type PublicSchoolOption } from "@/components/schools/SchoolSearchSelect";
import {
  autorizacaoAtaOptions,
  comunicouAbusoOptions,
  modalidadeOptions,
  normalizeRegiaoFromSchool,
  periodoOptions,
  regiaoEscolaLabel,
  regiaoEscolaOptions,
  alunoSerieOptions,
  alunoSerieValues,
  alunoSexoOptions,
  alunoTurmaOptions,
  alunoTurmaValues,
  solicitanteCargoOptions,
  solicitanteCargoValues,
  situacaoObservadaOptions,
  type AlunoSerie,
  type AlunoSexo,
  type AlunoTurma,
  type AutorizacaoAta,
  type ComunicouAbuso,
  type ModalidadeAcolhimento,
  type PeriodoEscolar,
  type SolicitanteCargo,
  type SituacaoObservada,
} from "@/lib/acolhimento-options";

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
  school_id: z.string().uuid("Selecione a escola ou EMEI"),
  school_nome: z.string().min(2, "Selecione a escola ou EMEI"),
  tipo_escola: z.enum(["escola", "emei"], { required_error: "Selecione a escola ou EMEI" }),
  regiao_escola: z.string().optional(),
  solicitante_email: z.string().email("Informe um e-mail válido"),
  solicitante_nome: z.string().min(2, "Informe o nome completo do solicitante"),
  solicitante_cargo: z.enum(solicitanteCargoValues, {
    required_error: "Selecione o cargo",
  }),
  solicitante_telefone: z.string().min(8, "Informe o telefone para contato"),
  modalidade_acolhimento: z.enum(["presencial", "online"], { required_error: "Selecione a modalidade" }),
  aluno_nome: z.string().min(2, "Informe o nome do aluno"),
  aluno_nascimento: z.string().min(1, "Informe a data de nascimento"),
  aluno_sexo: z.enum(["masculino", "feminino", "outro"], { required_error: "Selecione o sexo" }),
  educacao_especial: z.enum(["sim", "nao"], { required_error: "Selecione uma opção" }),
  aluno_serie: z.enum(alunoSerieValues, { required_error: "Selecione a série" }),
  aluno_turma: z.enum(alunoTurmaValues, { required_error: "Selecione a turma" }),
  periodo: z.enum(["matutino", "vespertino", "integral", "noturno"], { required_error: "Selecione o período" }),
  comunicou_abuso: z.array(z.string()).min(1, "Selecione ao menos uma opção"),
  situacao_observada: z.array(z.string()).min(1, "Selecione ao menos uma situação"),
  acolhido_anteriormente: z.enum(["sim", "nao"], { required_error: "Selecione uma opção" }),
  autorizacao_ata: z.enum(["ja_temos", "ainda_nao"], { required_error: "Selecione uma opção" }),
});

type FormValues = z.infer<typeof schema>;

const primaryBtn =
  "rounded-[14px] font-semibold text-white transition-all duration-300 ease-in-out shadow-[0_10px_30px_rgba(15,82,186,0.2)] bg-[#0F52BA] hover:bg-[#083D8C]";

const formCard =
  "rounded-[20px] border border-slate-100 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)]";

const optionLabel =
  "flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-colors has-[[data-state=checked]]:border-[#0F52BA] has-[[data-state=checked]]:bg-[#EAF2FF]/50";

const checkboxOptionLabel =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm transition-colors hover:border-slate-300 has-[[data-state=checked]]:border-[#0F52BA] has-[[data-state=checked]]:bg-[#EAF2FF]/50";

function AcolhimentoShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-50 h-20 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
            <img src="/logo_CPAE.png" alt="CPAE" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-[#0F172A]">Gestão de Sistemas</div>
              <div className="text-xs font-medium text-[#64748B]">CPAE</div>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#EAF2FF] hover:text-[#0F52BA]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-12 bg-[#083D8C] px-4 py-8 text-center text-sm text-white/90">
        © {new Date().getFullYear()} CPAE — Coordenadoria Municipal de Psicologia e Assistência Educacional
      </footer>
    </div>
  );
}

function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className={formCard}>
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#0F52BA]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-[#0F172A]">{title}</CardTitle>
            {description && <CardDescription className="mt-1 text-[#64748B]">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">{children}</CardContent>
    </Card>
  );
}

function AcolhimentoPublico() {
  const navigate = useNavigate();
  const [successNumero, setSuccessNumero] = useState<string | null>(null);

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["public-schools-acolhimento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, nome, regiao, tipo_escola")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as PublicSchoolOption[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      school_id: "",
      school_nome: "",
      comunicou_abuso: [],
      situacao_observada: [],
      regiao_escola: "",
    },
  });

  const selectedSchoolId = form.watch("school_id");
  const regiaoValue = form.watch("regiao_escola");
  const tipoEscolaValue = form.watch("tipo_escola");
  const regiaoKnown = regiaoEscolaOptions.some((o) => o.value === regiaoValue);

  const handleSchoolSelect = (school: PublicSchoolOption) => {
    form.setValue("school_id", school.id, { shouldValidate: true });
    form.setValue("school_nome", school.nome, { shouldValidate: true });
    form.setValue("tipo_escola", school.tipo_escola ?? "escola", { shouldValidate: true });
    form.setValue("regiao_escola", normalizeRegiaoFromSchool(school.regiao), { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitAcolhimentoRequest({
        school_id: values.school_id,
        school_nome: values.school_nome,
        tipo_escola: values.tipo_escola,
        solicitante_email: values.solicitante_email,
        regiao_escola: values.regiao_escola || null,
        solicitante_nome: values.solicitante_nome,
        solicitante_cargo: values.solicitante_cargo as SolicitanteCargo,
        solicitante_telefone: values.solicitante_telefone,
        modalidade_acolhimento: values.modalidade_acolhimento as ModalidadeAcolhimento,
        aluno_nome: values.aluno_nome,
        aluno_nascimento: values.aluno_nascimento,
        aluno_sexo: values.aluno_sexo as AlunoSexo,
        educacao_especial: values.educacao_especial,
        aluno_serie: values.aluno_serie as AlunoSerie,
        aluno_turma: values.aluno_turma as AlunoTurma,
        periodo: values.periodo as PeriodoEscolar,
        comunicou_abuso: values.comunicou_abuso as ComunicouAbuso[],
        situacao_observada: values.situacao_observada as SituacaoObservada[],
        acolhido_anteriormente: values.acolhido_anteriormente,
        autorizacao_ata: values.autorizacao_ata as AutorizacaoAta,
      }),
    onSuccess: (data) => {
      setSuccessNumero(data.numero);
      toast.success("Solicitação registrada!");
    },
    onError: (err: Error) => toast.error("Erro ao enviar", { description: err.message }),
  });

  const toggleArrayValue = (field: "comunicou_abuso" | "situacao_observada", value: string, checked: boolean) => {
    const current = form.getValues(field);
    form.setValue(
      field,
      checked ? [...current, value] : current.filter((v) => v !== value),
      { shouldValidate: true },
    );
  };

  if (successNumero) {
    return (
      <AcolhimentoShell>
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-16">
          <Card className={`w-full max-w-lg ${formCard} shadow-[0_20px_40px_rgba(15,23,42,0.08)]`}>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2FFF6] text-[#52C41A]">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <CardTitle className="mt-5 text-2xl font-bold text-[#0F172A]">Solicitação registrada</CardTitle>
              <CardDescription className="text-[#64748B]">
                Guarde o número de protocolo para acompanhamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-center">
              <div className="rounded-2xl border-2 border-dashed border-[#0F52BA]/25 bg-[#EAF2FF]/50 py-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Protocolo</div>
                <div className="mt-2 font-mono text-3xl font-bold text-[#0F52BA]">{successNumero}</div>
              </div>
              <p className="text-sm text-[#64748B]">A equipe da CPAE foi notificada e entrará em contato.</p>
              <Button onClick={() => navigate({ to: "/" })} className={`w-full ${primaryBtn}`}>
                Voltar ao início
              </Button>
            </CardContent>
          </Card>
        </div>
      </AcolhimentoShell>
    );
  }

  return (
    <AcolhimentoShell>
      <section className="relative bg-[url('/cpae-hero-bg.png')] bg-cover bg-center bg-no-repeat px-4 py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF2FF] px-4 py-1.5 text-sm font-semibold text-[#0F52BA]">
            <Shield className="h-4 w-4" />
            Formulário público
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
            Solicitação de <span className="text-[#0F52BA]">Acolhimento</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#64748B] sm:text-lg">
            Preencha todos os campos obrigatórios (*). Suas informações são tratadas com sigilo pela equipe da CPAE.
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-6 w-full max-w-6xl px-4 pb-12 lg:px-8 md:-mt-10">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="w-full space-y-6">
          <FormSection title="Identificação" description="Dados da escola e do solicitante" icon={School}>
              <Field label="1. Nome da Escola / EMEI *" error={form.formState.errors.school_id?.message ?? form.formState.errors.school_nome?.message}>
                <SchoolSearchSelect
                  schools={schools}
                  value={selectedSchoolId || null}
                  onSelect={handleSchoolSelect}
                  loading={schoolsLoading}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="2. Tipo Escola *" error={form.formState.errors.tipo_escola?.message}>
                  <Select value={tipoEscolaValue} disabled>
                    <SelectTrigger className="bg-muted/40">
                      <SelectValue placeholder="Selecione a escola acima" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="escola">Escola</SelectItem>
                      <SelectItem value="emei">EMEI</SelectItem>
                    </SelectContent>
                  </Select>
                  {tipoEscolaValue && (
                    <p className="text-xs text-muted-foreground">
                      Preenchido automaticamente: {schoolTipoLabels[tipoEscolaValue]}
                    </p>
                  )}
                </Field>

                <Field label="3. Região onde a Escola / EMEI está localizada">
                  {regiaoKnown && regiaoValue ? (
                    <Select value={regiaoValue} disabled>
                      <SelectTrigger className="bg-muted/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regiaoEscolaOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      readOnly
                      disabled
                      className="bg-muted/40"
                      value={regiaoValue ? regiaoEscolaLabel(regiaoValue) : ""}
                      placeholder="Selecione a escola acima"
                    />
                  )}
                </Field>
              </div>

              <Field label="4. Nome completo do solicitante *" error={form.formState.errors.solicitante_nome?.message}>
                <Input placeholder="Ex.: Maria Silva" {...form.register("solicitante_nome")} />
              </Field>

              <Field label="5. E-mail *" error={form.formState.errors.solicitante_email?.message}>
                <Input type="email" placeholder="seu.email@escola.ms.gov.br" {...form.register("solicitante_email")} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="6. Cargo do(a) Solicitante *" error={form.formState.errors.solicitante_cargo?.message}>
                  <Controller
                    control={form.control}
                    name="solicitante_cargo"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {solicitanteCargoOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="7. Telefone para contato *" error={form.formState.errors.solicitante_telefone?.message}>
                  <Input placeholder="(67) 99999-9999" {...form.register("solicitante_telefone")} />
                </Field>
              </div>
          </FormSection>

          <FormSection title="Acolhimento" description="Modalidade do atendimento" icon={HeartHandshake}>
              <Field label="8. Modalidade do acolhimento *" error={form.formState.errors.modalidade_acolhimento?.message}>
                <Controller
                  control={form.control}
                  name="modalidade_acolhimento"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                      {modalidadeOptions.map((o) => (
                        <label
                          key={o.value}
                          className={optionLabel}
                        >
                          <RadioGroupItem value={o.value} />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
          </FormSection>

          <FormSection title="Dados do(a) aluno(a)" description="Informações do estudante" icon={GraduationCap}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="9. Nome do(a) aluno(a) *" error={form.formState.errors.aluno_nome?.message}>
                  <Input {...form.register("aluno_nome")} />
                </Field>

                <Field label="10. Data de Nascimento *" error={form.formState.errors.aluno_nascimento?.message}>
                  <Input type="date" {...form.register("aluno_nascimento")} />
                </Field>

                <Field label="11. Sexo *" error={form.formState.errors.aluno_sexo?.message}>
                  <Controller
                    control={form.control}
                    name="aluno_sexo"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {alunoSexoOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="12. O(a) estudante é público-alvo da Educação Especial *" error={form.formState.errors.educacao_especial?.message}>
                  <Controller
                    control={form.control}
                    name="educacao_especial"
                    render={({ field }) => (
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-3">
                        <label className={optionLabel}>
                          <RadioGroupItem value="sim" /> Sim
                        </label>
                        <label className={optionLabel}>
                          <RadioGroupItem value="nao" /> Não
                        </label>
                      </RadioGroup>
                    )}
                  />
                </Field>

                <Field label="13. Série *" error={form.formState.errors.aluno_serie?.message}>
                  <Controller
                    control={form.control}
                    name="aluno_serie"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a série" />
                        </SelectTrigger>
                        <SelectContent>
                          {alunoSerieOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="14. Turma *" error={form.formState.errors.aluno_turma?.message}>
                  <Controller
                    control={form.control}
                    name="aluno_turma"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a turma" />
                        </SelectTrigger>
                        <SelectContent>
                          {alunoTurmaOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="15. Período *" error={form.formState.errors.periodo?.message}>
                  <Controller
                    control={form.control}
                    name="periodo"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          {periodoOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
          </FormSection>

          <FormSection title="Situação e comunicações" description="Contexto do acolhimento solicitado" icon={ClipboardList}>
              <Field
                label="16. Em caso de abuso ou outras negligências, a Escola comunicou *"
                error={form.formState.errors.comunicou_abuso?.message}
              >
                <div className="grid gap-2">
                  {comunicouAbusoOptions.map((o) => {
                    const checked = form.watch("comunicou_abuso").includes(o.value);
                    return (
                    <label
                      key={o.value}
                      className={`${checkboxOptionLabel}${checked ? " border-[#0F52BA] bg-[#EAF2FF]/50" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleArrayValue("comunicou_abuso", o.value, c === true)}
                        className="mt-0.5"
                      />
                      <span>{o.label}</span>
                    </label>
                    );
                  })}
                </div>
              </Field>

              <Field
                label="17. Selecione a situação observada *"
                error={form.formState.errors.situacao_observada?.message}
              >
                <div className="grid gap-2">
                  {situacaoObservadaOptions.map((o) => {
                    const checked = form.watch("situacao_observada").includes(o.value);
                    return (
                    <label
                      key={o.value}
                      className={`${checkboxOptionLabel}${checked ? " border-[#0F52BA] bg-[#EAF2FF]/50" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleArrayValue("situacao_observada", o.value, c === true)}
                        className="mt-0.5"
                      />
                      <span>{o.label}</span>
                    </label>
                    );
                  })}
                </div>
              </Field>

              <Field label="18. O(a) aluno(a) já foi acolhido pela CPAE anteriormente? *" error={form.formState.errors.acolhido_anteriormente?.message}>
                <Controller
                  control={form.control}
                  name="acolhido_anteriormente"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-3">
                      <label className={optionLabel}>
                        <RadioGroupItem value="sim" /> Sim
                      </label>
                      <label className={optionLabel}>
                        <RadioGroupItem value="nao" /> Não
                      </label>
                    </RadioGroup>
                  )}
                />
              </Field>

              <Field
                label="19. A escola tem autorização do(a) responsável em ata para a realização do acolhimento? *"
                error={form.formState.errors.autorizacao_ata?.message}
              >
                <Controller
                  control={form.control}
                  name="autorizacao_ata"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2">
                      {autorizacaoAtaOptions.map((o) => (
                        <label key={o.value} className={`${optionLabel} items-start`}>
                          <RadioGroupItem value={o.value} className="mt-0.5" />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
          </FormSection>

          <Button type="submit" size="lg" className={`w-full ${primaryBtn} py-6 text-base`} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitação
          </Button>
        </form>
      </main>
    </AcolhimentoShell>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-[#0F172A]">{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
