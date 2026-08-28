import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import {
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Sparkles,
  School,
  Users,
  Mic2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { submitVivenciaRequest } from "@/lib/vivencias-submit";
import { loadPublicSchools, publicSchoolsErrorMessage } from "@/lib/public-schools";
import { schoolTipoLabels } from "@/lib/labels";
import { SchoolSearchSelect } from "@/components/schools/SchoolSearchSelect";
import { VivenciaDatePicker } from "@/components/vivencias/VivenciaDatePicker";
import { VisitStartTimeSelect } from "@/components/vivencias/VisitStartTimeSelect";
import type { PublicSchoolOption } from "@/lib/public-schools";
import {
  normalizeRegiaoFromSchool,
  periodoOptions,
  regiaoEscolaLabel,
  regiaoEscolaOptions,
  solicitanteCargoOptions,
  solicitanteCargoValues,
  type PeriodoEscolar,
  type SolicitanteCargo,
} from "@/lib/acolhimento-options";
import { fetchActiveSeries, fetchActiveTurmas, labelsMap } from "@/lib/serie-turma-catalog";
import { DalealDeveloperBanner } from "@/components/layout/DalealDeveloperBanner";
import {
  palestraTemaOptions,
  vivenciaTemaOptions,
  type PalestraTema,
  type VivenciaTema,
} from "@/lib/vivencias-options";

export const Route = createFileRoute("/vivencias")({
  head: () => ({
    meta: [
      { title: "Solicitar Vivência e Palestra — CPAE" },
      {
        name: "description",
        content: "Formulário público para solicitação de vivências e palestras da CPAE.",
      },
    ],
  }),
  component: VivenciasPublico,
});

const groupSchema = z.object({
  aluno_serie: z.string().optional(),
  aluno_turma: z.string().optional(),
  periodo: z.string().optional(),
  temas: z.array(z.string()).default([]),
  data_vivencia: z.string().optional(),
  hora_inicio: z.string().optional(),
});

const palestraSchema = z.object({
  aluno_serie: z.string().optional(),
  aluno_turma: z.string().optional(),
  periodo: z.string().optional(),
  palestra_tema: z.string().optional(),
  data_preferivel: z.string().optional(),
  hora_inicio: z.string().optional(),
});

function isGroupEmpty(g: {
  aluno_serie?: string;
  aluno_turma?: string;
  periodo?: string;
  temas?: string[];
}): boolean {
  return !g.aluno_serie && !g.aluno_turma && !g.periodo && (g.temas?.length ?? 0) === 0;
}

function isGroupComplete(g: {
  aluno_serie?: string;
  aluno_turma?: string;
  periodo?: string;
  temas?: string[];
}): boolean {
  return Boolean(
    g.aluno_serie &&
      g.aluno_turma &&
      g.periodo &&
      (g.temas?.length ?? 0) > 0,
  );
}

function isPalestraEmpty(p: {
  aluno_serie?: string;
  aluno_turma?: string;
  periodo?: string;
  palestra_tema?: string;
}): boolean {
  return !p.aluno_serie && !p.aluno_turma && !p.periodo && !p.palestra_tema;
}

function isPalestraComplete(p: {
  aluno_serie?: string;
  aluno_turma?: string;
  periodo?: string;
  palestra_tema?: string;
}): boolean {
  return Boolean(p.aluno_serie && p.aluno_turma && p.periodo && p.palestra_tema);
}

const schema = z
  .object({
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
    groups: z.array(groupSchema),
    palestras: z.array(palestraSchema),
  })
  .superRefine((val, ctx) => {
    const completeGroups = val.groups.filter(isGroupComplete);
    const completePalestras = val.palestras.filter(isPalestraComplete);

    if (completeGroups.length === 0 && completePalestras.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Adicione ao menos uma vivência completa ou uma palestra completa",
        path: ["groups"],
      });
    }

    val.groups.forEach((g, i) => {
      if (isGroupEmpty(g)) return;
      if (!g.aluno_serie) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a série",
          path: ["groups", i, "aluno_serie"],
        });
      }
      if (!g.aluno_turma) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a turma",
          path: ["groups", i, "aluno_turma"],
        });
      }
      if (!g.periodo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione o período",
          path: ["groups", i, "periodo"],
        });
      }
      if ((g.temas?.length ?? 0) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione ao menos um tema",
          path: ["groups", i, "temas"],
        });
      }
    });

    val.palestras.forEach((p, i) => {
      if (isPalestraEmpty(p)) return;
      if (!p.aluno_serie) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a série",
          path: ["palestras", i, "aluno_serie"],
        });
      }
      if (!p.aluno_turma) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a turma",
          path: ["palestras", i, "aluno_turma"],
        });
      }
      if (!p.periodo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione o período",
          path: ["palestras", i, "periodo"],
        });
      }
      if (!p.palestra_tema) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a palestra",
          path: ["palestras", i, "palestra_tema"],
        });
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const primaryBtn =
  "rounded-[14px] font-semibold text-white transition-all duration-300 ease-in-out shadow-[0_10px_30px_rgba(15,82,186,0.2)] bg-[#0F52BA] hover:bg-[#083D8C]";

const formCard =
  "rounded-[20px] border border-slate-100 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)]";

const checkboxOptionLabel =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm transition-colors hover:border-slate-300 has-[[data-state=checked]]:border-[#0F52BA] has-[[data-state=checked]]:bg-[#EAF2FF]/50";

function emptyGroup() {
  return {
    aluno_serie: undefined as unknown as string,
    aluno_turma: undefined as unknown as string,
    periodo: undefined as unknown as PeriodoEscolar,
    temas: [] as string[],
    data_vivencia: "",
    hora_inicio: "",
  };
}

function emptyPalestra() {
  return {
    aluno_serie: undefined as unknown as string,
    aluno_turma: undefined as unknown as string,
    periodo: undefined as unknown as PeriodoEscolar,
    palestra_tema: undefined as unknown as string,
    data_preferivel: "",
    hora_inicio: "",
  };
}

function TemasMultiSelect({
  selected,
  onToggle,
  onRemove,
  hasError,
}: {
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  onRemove: (value: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOptions = vivenciaTemaOptions.filter((o) => selected.includes(o.value));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F52BA]/30 ${
              hasError ? "border-destructive" : "border-input hover:border-slate-300"
            }`}
          >
            <span className={selected.length ? "text-[#0F172A]" : "text-muted-foreground"}>
              {selected.length
                ? `${selected.length} tema${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""}`
                : "Selecione os temas"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[320px] w-[--radix-popover-trigger-width] overflow-y-auto p-2"
        >
          <div className="grid gap-2">
            {vivenciaTemaOptions.map((o) => (
              <label key={o.value} className={checkboxOptionLabel}>
                <Checkbox
                  checked={selected.includes(o.value)}
                  onCheckedChange={(c) => onToggle(o.value, c === true)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#0F52BA]/25 bg-[#EAF2FF]/60 py-1 pl-3 pr-1.5 text-xs font-medium text-[#0F52BA]"
            >
              <span className="truncate">{o.label}</span>
              <button
                type="button"
                aria-label={`Remover ${o.label}`}
                onClick={() => onRemove(o.value)}
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-[#0F52BA]/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function VivenciasShell({ children }: { children: React.ReactNode }) {
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
      <DalealDeveloperBanner />
      <footer className="mt-6 bg-[#083D8C] px-4 py-8 text-center text-sm text-white/90">
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-[#0F172A]">{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function VivenciasPublico() {
  const navigate = useNavigate();
  const [successNumero, setSuccessNumero] = useState<string | null>(null);

  const {
    data: schools = [],
    isPending: schoolsLoading,
    isError: schoolsError,
    error: schoolsFetchError,
    refetch: refetchSchools,
    isFetching: schoolsFetching,
  } = useQuery({
    queryKey: ["public-schools-vivencias"],
    queryFn: () => loadPublicSchools(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { data: serieOptions = [] } = useQuery({
    queryKey: ["catalog-series"],
    queryFn: fetchActiveSeries,
    staleTime: 5 * 60 * 1000,
  });

  const { data: turmaOptions = [] } = useQuery({
    queryKey: ["catalog-turmas"],
    queryFn: fetchActiveTurmas,
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      school_id: "",
      school_nome: "",
      regiao_escola: "",
      groups: [emptyGroup()],
      palestras: [emptyPalestra()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "groups",
  });
  const {
    fields: palestraFields,
    append: appendPalestra,
    remove: removePalestra,
  } = useFieldArray({
    control: form.control,
    name: "palestras",
  });

  const selectedSchoolId = form.watch("school_id");
  const regiaoValue = form.watch("regiao_escola");
  const tipoEscolaValue = form.watch("tipo_escola");
  const regiaoKnown = regiaoEscolaOptions.some((o) => o.value === regiaoValue);

  const watchedGroups = form.watch("groups");
  const watchedPalestras = form.watch("palestras");

  const handleSchoolSelect = (school: PublicSchoolOption) => {
    form.setValue("school_id", school.id, { shouldValidate: true });
    form.setValue("school_nome", school.nome, { shouldValidate: true });
    form.setValue("tipo_escola", school.tipo_escola ?? "escola", { shouldValidate: true });
    form.setValue("regiao_escola", normalizeRegiaoFromSchool(school.regiao), { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const completeGroups = values.groups.filter(isGroupComplete);
      const completePalestras = values.palestras.filter(isPalestraComplete);
      return submitVivenciaRequest({
        school_id: values.school_id,
        school_nome: values.school_nome,
        tipo_escola: values.tipo_escola,
        solicitante_email: values.solicitante_email,
        regiao_escola: values.regiao_escola || null,
        solicitante_nome: values.solicitante_nome,
        solicitante_cargo: values.solicitante_cargo as SolicitanteCargo,
        solicitante_telefone: values.solicitante_telefone,
        groups: completeGroups.map((g) => ({
          aluno_serie: g.aluno_serie as string,
          aluno_turma: g.aluno_turma as string,
          periodo: g.periodo as PeriodoEscolar,
          temas: g.temas as VivenciaTema[],
          data_vivencia: g.data_vivencia || null,
          hora_inicio: g.hora_inicio || null,
        })),
        palestras: completePalestras.map((p) => ({
          aluno_serie: p.aluno_serie as string,
          aluno_turma: p.aluno_turma as string,
          periodo: p.periodo as PeriodoEscolar,
          palestra_tema: p.palestra_tema as PalestraTema,
          data_preferivel: p.data_preferivel || null,
          hora_inicio: p.hora_inicio || null,
        })),
        serieLabels: labelsMap(serieOptions),
        turmaLabels: labelsMap(turmaOptions),
      });
    },
    onSuccess: (data) => {
      setSuccessNumero(data.numero);
      toast.success("Solicitação registrada!");
    },
    onError: (err: Error) => toast.error("Erro ao enviar", { description: err.message }),
  });

  const toggleTema = (groupIndex: number, value: string, checked: boolean) => {
    const current = form.getValues(`groups.${groupIndex}.temas`) ?? [];
    form.setValue(
      `groups.${groupIndex}.temas`,
      checked ? [...current, value] : current.filter((v) => v !== value),
      { shouldValidate: true },
    );
  };

  if (successNumero) {
    return (
      <VivenciasShell>
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-16">
          <Card className={`w-full max-w-lg ${formCard} shadow-[0_20px_40px_rgba(15,23,42,0.08)]`}>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2FFF6] text-[#52C41A]">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <CardTitle className="mt-5 text-2xl font-bold text-[#0F172A]">Solicitação registrada</CardTitle>
              <CardDescription className="text-[#64748B]">
                Guarde o número de protocolo. A equipe de Vivências entrará em contato pelo WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-center">
              <div className="rounded-2xl border-2 border-dashed border-[#0F52BA]/25 bg-[#EAF2FF]/50 py-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Protocolo</div>
                <div className="mt-2 font-mono text-3xl font-bold text-[#0F52BA]">{successNumero}</div>
              </div>
              <Button onClick={() => navigate({ to: "/" })} className={`w-full ${primaryBtn}`}>
                Voltar ao início
              </Button>
            </CardContent>
          </Card>
        </div>
      </VivenciasShell>
    );
  }

  return (
    <VivenciasShell>
      <section className="relative bg-[url('/cpae-hero-bg.png')] bg-cover bg-center bg-no-repeat px-4 py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF2FF] px-4 py-1.5 text-sm font-semibold text-[#0F52BA]">
            <Sparkles className="h-4 w-4" />
            Formulário público
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
            Solicitação de <span className="text-[#0F52BA]">Vivência e Palestra</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#64748B] sm:text-lg">
            Pré-agendamento das ações da CPAE. Preencha os campos obrigatórios (*). A equipe confirmará a data pelo WhatsApp.
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-6 w-full max-w-6xl px-4 pb-12 lg:px-8 md:-mt-10">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="w-full space-y-6">
          <FormSection title="Identificação" description="Dados da escola e do solicitante" icon={School}>
            <Field
              label="1. Nome da Escola / EMEI *"
              error={form.formState.errors.school_id?.message ?? form.formState.errors.school_nome?.message}
            >
              <SchoolSearchSelect
                schools={schools}
                value={selectedSchoolId || null}
                onSelect={handleSchoolSelect}
                loading={schoolsLoading || schoolsFetching}
                error={schoolsError ? publicSchoolsErrorMessage(schoolsFetchError) : null}
                onRetry={() => refetchSchools()}
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
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
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
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
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

          <FormSection
            title="Vivências para alunos"
            description="Opcional se solicitar apenas palestra. Inclua séries/turmas/períodos com seus temas, se desejar."
            icon={Users}
          >
            {form.formState.errors.groups?.root?.message && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.groups.root.message}</p>
            )}
            {typeof form.formState.errors.groups?.message === "string" && (
              <p className="text-xs font-medium text-destructive">{form.formState.errors.groups.message}</p>
            )}

            <div className="space-y-5">
              {fields.map((field, index) => {
                const groupErrors = form.formState.errors.groups?.[index];
                const temas = form.watch(`groups.${index}.temas`) ?? [];
                const periodo = form.watch(`groups.${index}.periodo`);
                const groupsSnapshot = form.watch("groups") ?? [];
                const extraOccupiedDates = groupsSnapshot
                  .map((g, i) =>
                    i !== index && g.periodo && periodo && g.periodo === periodo && g.data_vivencia
                      ? g.data_vivencia
                      : null,
                  )
                  .filter((d): d is string => Boolean(d));

                const groupRequiredMark = " *";

                return (
                  <div
                    key={field.id}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Turma {index + 1}
                        {fields.length > 1 ? ` de ${fields.length}` : ""}
                      </h3>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remover
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label={`Série${groupRequiredMark}`} error={groupErrors?.aluno_serie?.message}>
                        <Controller
                          control={form.control}
                          name={`groups.${index}.aluno_serie`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a série" />
                              </SelectTrigger>
                              <SelectContent>
                                {serieOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>

                      <Field label={`Turma${groupRequiredMark}`} error={groupErrors?.aluno_turma?.message}>
                        <Controller
                          control={form.control}
                          name={`groups.${index}.aluno_turma`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a turma" />
                              </SelectTrigger>
                              <SelectContent>
                                {turmaOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>

                      <Field label={`Período${groupRequiredMark}`} error={groupErrors?.periodo?.message}>
                        <Controller
                          control={form.control}
                          name={`groups.${index}.periodo`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o período" />
                              </SelectTrigger>
                              <SelectContent>
                                {periodoOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>
                    </div>

                    <div className="space-y-4">
                      <Field
                        label={`Temas de vivências${groupRequiredMark}`}
                        error={groupErrors?.temas?.message}
                      >
                        <p className="mb-2 text-xs text-[#64748B]">Marque todas que se aplicam a esta turma.</p>
                        <TemasMultiSelect
                          selected={temas}
                          onToggle={(value, checked) => toggleTema(index, value, checked)}
                          onRemove={(value) => toggleTema(index, value, false)}
                          hasError={Boolean(groupErrors?.temas?.message)}
                        />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Data preferível da Vivência">
                          <p className="mb-2 text-xs text-[#64748B]">
                            Dias úteis em verde; laranja = já há solicitação na mesma região e período. Sujeita à
                            confirmação da equipe.
                          </p>
                          <Controller
                            control={form.control}
                            name={`groups.${index}.data_vivencia`}
                            render={({ field: f }) => (
                              <VivenciaDatePicker
                                value={f.value}
                                onChange={f.onChange}
                                regiao={regiaoValue}
                                periodo={periodo}
                                extraOccupiedDates={extraOccupiedDates}
                              />
                            )}
                          />
                        </Field>

                        <Field label="Horário de início">
                          <p className="mb-2 text-xs text-[#64748B]">
                            Hora (07–21) e minuto (00/15/30/45). Na agenda a duração será sempre de 1 hora.
                          </p>
                          <Controller
                            control={form.control}
                            name={`groups.${index}.hora_inicio`}
                            render={({ field: f }) => (
                              <VisitStartTimeSelect value={f.value ?? ""} onChange={f.onChange} />
                            )}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-[14px] border-dashed border-[#0F52BA]/40 text-[#0F52BA] hover:bg-[#EAF2FF] disabled:cursor-not-allowed"
              disabled={watchedGroups.length > 0 && !watchedGroups.every(isGroupComplete)}
              onClick={() => append(emptyGroup())}
            >
              <Plus className="mr-2 h-4 w-4" />
              {fields.length === 0
                ? "Adicionar série / turma / período"
                : "Adicionar outra série / turma / período"}
            </Button>
            {watchedGroups.length > 0 && !watchedGroups.every((g) => isGroupComplete(g) || isGroupEmpty(g)) && (
              <p className="text-center text-xs text-[#64748B]">
                Preencha série, turma, período e ao menos um tema da turma atual para adicionar outra.
              </p>
            )}
          </FormSection>

          <FormSection
            title="Palestras"
            description="Opcional se já houver vivências. Você pode adicionar mais de uma palestra para séries, turmas e períodos diferentes."
            icon={Mic2}
          >
            <div className="space-y-5">
              {palestraFields.map((field, index) => {
                const palestraErrors = form.formState.errors.palestras?.[index];
                const periodo = form.watch(`palestras.${index}.periodo`);
                const palestrasSnapshot = form.watch("palestras") ?? [];
                const extraOccupiedDates = palestrasSnapshot
                  .map((p, i) =>
                    i !== index && p.data_preferivel ? p.data_preferivel : null,
                  )
                  .filter((d): d is string => Boolean(d));

                return (
                  <div
                    key={field.id}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Palestra {index + 1}
                        {palestraFields.length > 1 ? ` de ${palestraFields.length}` : ""}
                      </h3>
                      {palestraFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removePalestra(index)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remover
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Série *" error={palestraErrors?.aluno_serie?.message}>
                        <Controller
                          control={form.control}
                          name={`palestras.${index}.aluno_serie`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a série" />
                              </SelectTrigger>
                              <SelectContent>
                                {serieOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>

                      <Field label="Turma *" error={palestraErrors?.aluno_turma?.message}>
                        <Controller
                          control={form.control}
                          name={`palestras.${index}.aluno_turma`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a turma" />
                              </SelectTrigger>
                              <SelectContent>
                                {turmaOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>

                      <Field label="Período *" error={palestraErrors?.periodo?.message}>
                        <Controller
                          control={form.control}
                          name={`palestras.${index}.periodo`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o período" />
                              </SelectTrigger>
                              <SelectContent>
                                {periodoOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>
                    </div>

                    <Field label="Tema da palestra *" error={palestraErrors?.palestra_tema?.message}>
                      <Controller
                        control={form.control}
                        name={`palestras.${index}.palestra_tema`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a palestra" />
                            </SelectTrigger>
                            <SelectContent>
                              {palestraTemaOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Data preferível da Palestra">
                        <p className="mb-2 text-xs text-[#64748B]">
                          Dias úteis em verde; laranja = já há vivência ou palestra na mesma região. Sujeita à
                          confirmação da equipe.
                        </p>
                        <Controller
                          control={form.control}
                          name={`palestras.${index}.data_preferivel`}
                          render={({ field: f }) => (
                            <VivenciaDatePicker
                              kind="palestra"
                              value={f.value}
                              onChange={f.onChange}
                              regiao={regiaoValue}
                              periodo={periodo}
                              extraOccupiedDates={[
                                ...(watchedGroups ?? [])
                                  .map((g) => g.data_vivencia)
                                  .filter((d): d is string => Boolean(d)),
                                ...extraOccupiedDates,
                              ]}
                            />
                          )}
                        />
                      </Field>
                      <Field label="Horário de início">
                        <p className="mb-2 text-xs text-[#64748B]">
                          Hora (07–21) e minuto (00/15/30/45). Na agenda a duração será sempre de 1 hora.
                        </p>
                        <Controller
                          control={form.control}
                          name={`palestras.${index}.hora_inicio`}
                          render={({ field: f }) => (
                            <VisitStartTimeSelect value={f.value ?? ""} onChange={f.onChange} />
                          )}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-[14px] border-dashed border-[#0F52BA]/40 text-[#0F52BA] hover:bg-[#EAF2FF] disabled:cursor-not-allowed"
              disabled={watchedPalestras.length > 0 && !watchedPalestras.every((p) => isPalestraComplete(p) || isPalestraEmpty(p))}
              onClick={() => appendPalestra(emptyPalestra())}
            >
              <Plus className="mr-2 h-4 w-4" />
              {palestraFields.length === 0
                ? "Adicionar palestra"
                : "Adicionar outra palestra"}
            </Button>
            {watchedPalestras.length > 0 && !watchedPalestras.every((p) => isPalestraComplete(p) || isPalestraEmpty(p)) && (
              <p className="text-center text-xs text-[#64748B]">
                Preencha série, turma, período e a palestra atual para adicionar outra.
              </p>
            )}
          </FormSection>

          <Button type="submit" size="lg" className={`w-full ${primaryBtn} py-6 text-base`} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitação
          </Button>
        </form>
      </main>
    </VivenciasShell>
  );
}
