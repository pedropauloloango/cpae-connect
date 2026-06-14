import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
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
  alunoSexoOptions,
  alunoTurmaOptions,
  solicitanteCargoOptions,
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
  solicitante_cargo: z.enum(["diretor", "diretor_adjunto", "secretario"], {
    required_error: "Selecione o cargo",
  }),
  solicitante_telefone: z.string().min(8, "Informe o telefone para contato"),
  modalidade_acolhimento: z.enum(["presencial", "online"], { required_error: "Selecione a modalidade" }),
  aluno_nome: z.string().min(2, "Informe o nome do aluno"),
  aluno_nascimento: z.string().min(1, "Informe a data de nascimento"),
  aluno_sexo: z.enum(["masculino", "feminino", "outro"], { required_error: "Selecione o sexo" }),
  educacao_especial: z.enum(["sim", "nao"], { required_error: "Selecione uma opção" }),
  aluno_serie: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"], { required_error: "Selecione a série" }),
  aluno_turma: z.enum(["A", "B", "C", "D", "E"], { required_error: "Selecione a turma" }),
  periodo: z.enum(["matutino", "vespertino", "integral", "noturno"], { required_error: "Selecione o período" }),
  comunicou_abuso: z.array(z.string()).min(1, "Selecione ao menos uma opção"),
  situacao_observada: z.array(z.string()).min(1, "Selecione ao menos uma situação"),
  acolhido_anteriormente: z.enum(["sim", "nao"], { required_error: "Selecione uma opção" }),
  autorizacao_ata: z.enum(["ja_temos", "ainda_nao"], { required_error: "Selecione uma opção" }),
});

type FormValues = z.infer<typeof schema>;

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
            <p className="text-sm text-muted-foreground">A equipe da CPAE foi notificada e entrará em contato.</p>
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
            Preencha todos os campos obrigatórios (*). Suas informações são tratadas com sigilo pela equipe da CPAE.
          </p>
        </div>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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

              <Field label="4. E-mail *" error={form.formState.errors.solicitante_email?.message}>
                <Input type="email" placeholder="seu.email@escola.ms.gov.br" {...form.register("solicitante_email")} />
              </Field>

              <Field label="5. Nome completo do solicitante *" error={form.formState.errors.solicitante_nome?.message}>
                <Input placeholder="Ex.: Maria Silva" {...form.register("solicitante_nome")} />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Acolhimento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="8. Modalidade do acolhimento *" error={form.formState.errors.modalidade_acolhimento?.message}>
                <Controller
                  control={form.control}
                  name="modalidade_acolhimento"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
                      {modalidadeOptions.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value={o.value} />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Dados do(a) aluno(a)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="9. Nome do(a) aluno(a) *" error={form.formState.errors.aluno_nome?.message}>
                <Input {...form.register("aluno_nome")} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
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

              <Field label="12. O(a) estudante é público-alvo da Educação Especial *" error={form.formState.errors.educacao_especial?.message}>
                <Controller
                  control={form.control}
                  name="educacao_especial"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="sim" /> Sim
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="nao" /> Não
                      </label>
                    </RadioGroup>
                  )}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <Field label="15. Período *" error={form.formState.errors.periodo?.message}>
                <Controller
                  control={form.control}
                  name="periodo"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                      {periodoOptions.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value={o.value} />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Situação e comunicações</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <Field
                label="16. Em caso de abuso ou outras negligências, a Escola comunicou *"
                error={form.formState.errors.comunicou_abuso?.message}
              >
                <div className="space-y-2">
                  {comunicouAbusoOptions.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={form.watch("comunicou_abuso").includes(o.value)}
                        onCheckedChange={(c) => toggleArrayValue("comunicou_abuso", o.value, c === true)}
                        className="mt-0.5"
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field
                label="17. Selecione a situação observada *"
                error={form.formState.errors.situacao_observada?.message}
              >
                <div className="space-y-2">
                  {situacaoObservadaOptions.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={form.watch("situacao_observada").includes(o.value)}
                        onCheckedChange={(c) => toggleArrayValue("situacao_observada", o.value, c === true)}
                        className="mt-0.5"
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="18. O(a) aluno(a) já foi acolhido pela CPAE anteriormente? *" error={form.formState.errors.acolhido_anteriormente?.message}>
                <Controller
                  control={form.control}
                  name="acolhido_anteriormente"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="sim" /> Sim
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
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
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
                      {autorizacaoAtaOptions.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm">
                          <RadioGroupItem value={o.value} className="mt-0.5" />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
