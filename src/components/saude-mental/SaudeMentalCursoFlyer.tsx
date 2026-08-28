import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  HandHeart,
  Heart,
  Laptop,
  Leaf,
  MessageCircle,
  Network,
  Quote,
  TrendingUp,
  Users,
  Brain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SaudeMentalCursoHero } from "@/components/saude-mental/SaudeMentalCursoHero";
import { SaudeMentalBrainLogo } from "@/components/saude-mental/SaudeMentalBrainLogo";
import { SaudeMentalInscricaoCta } from "@/components/saude-mental/SaudeMentalInscricaoCta";
import { fetchSaudeMentalInscricaoStatus } from "@/lib/saude-mental-inscricao-config";

const C = {
  blue: "#0F52BA",
  blueDark: "#083D8C",
  purple: "#7B2CBF",
  purpleLight: "#9333EA",
  orange: "#FF8C00",
  green: "#52C41A",
  yellow: "#F7B500",
  pink: "#D633C6",
  teal: "#14B8A6",
  text: "#0F172A",
  muted: "#64748B",
} as const;

type Objective = { n: string; icon: LucideIcon; color: string; bg: string; title: string; text: string };
type Module = { n: number; title: string; accent: "purple" | "yellow" };

const objectives: Objective[] = [
  {
    n: "01",
    icon: Brain,
    color: C.purple,
    bg: "bg-violet-50",
    title: "Identificar",
    text: "Reconhecer sinais de sofrimento psíquico em estudantes e servidores.",
  },
  {
    n: "02",
    icon: HandHeart,
    color: C.blue,
    bg: "bg-blue-50",
    title: "Acolher",
    text: "Desenvolver estratégias de acolhimento e apoio emocional.",
  },
  {
    n: "03",
    icon: TrendingUp,
    color: C.orange,
    bg: "bg-orange-50",
    title: "Compreender",
    text: "Relacionar saúde mental, desempenho acadêmico e bem-estar profissional.",
  },
  {
    n: "04",
    icon: Leaf,
    color: C.green,
    bg: "bg-emerald-50",
    title: "Cuidar",
    text: "Reconhecer a importância de bons hábitos de vida e autocuidado.",
  },
  {
    n: "05",
    icon: Network,
    color: C.pink,
    bg: "bg-pink-50",
    title: "Conectar",
    text: "Fortalecer parcerias com redes de cuidado psicológico e psiquiátrico.",
  },
  {
    n: "06",
    icon: MessageCircle,
    color: C.teal,
    bg: "bg-teal-50",
    title: "Dialogar",
    text: "Criar espaços de diálogo e troca de experiências.",
  },
];

const modules: Module[] = [
  { n: 1, title: "Introdução à Saúde Mental na Educação", accent: "purple" },
  { n: 2, title: "Saúde Mental de Crianças e Adolescentes no Contexto Escolar", accent: "purple" },
  { n: 3, title: "Escuta, Acolhimento e Prevenção: O Papel da Escola", accent: "purple" },
  { n: 4, title: "Setembro Amarelo (Prevenção ao Suicídio): Escola que Acolhe, Escuta e Protege", accent: "yellow" },
  { n: 5, title: "Qualidade de Vida, Bem-estar e Saúde Mental", accent: "purple" },
  { n: 6, title: "Práticas Integrativas e Estratégias de Promoção da Saúde", accent: "purple" },
  { n: 7, title: "Prevenção ao Burnout e Bem-estar dos Educadores", accent: "yellow" },
  { n: 8, title: "Saúde Mental na Escola: Caminhos para uma Cultura de Cuidado", accent: "purple" },
];

const methodology = [
  "Exposições dialogadas e participativas",
  "Estudos de caso e análise de situações reais",
  "Oficinas práticas e atividades colaborativas",
  "Rodas de conversa e escuta qualificada",
  "Atividades reflexivas e produção de materiais",
  "Avaliação diagnóstica e acompanhamento formativo",
];

const flowSteps = [
  { icon: Users, label: "Encontros presenciais" },
  { icon: Laptop, label: "Atividades on-line" },
  { icon: CheckCircle2, label: "Acompanhamento e suporte" },
  { icon: GraduationCap, label: "Avaliação e certificação" },
];

function SectionTitle({ children, color = C.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <h2
      className="mb-6 text-center text-xl font-extrabold uppercase tracking-wide sm:text-2xl"
      style={{ color }}
    >
      {children}
    </h2>
  );
}

function IconCircle({
  icon: Icon,
  color,
  bg,
  size = "md",
}: {
  icon: LucideIcon;
  color: string;
  bg: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-10 w-10", md: "h-12 w-12", lg: "h-14 w-14" };
  const iconSizes = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-7 w-7" };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${bg} ${sizes[size]}`}
      style={{ color }}
    >
      <Icon className={iconSizes[size]} strokeWidth={2} />
    </div>
  );
}

export function SaudeMentalCursoFlyer() {
  const statusQuery = useQuery({
    queryKey: ["saude-mental-inscricao-status"],
    queryFn: fetchSaudeMentalInscricaoStatus,
    staleTime: 60_000,
  });

  return (
    <article className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_60px_rgba(15,82,186,0.08)]">
      <SaudeMentalCursoHero />

      {/* Sobre + Para quem */}
      <section className="grid gap-6 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:gap-8">
        <div>
          <h2 className="mb-3 text-lg font-extrabold uppercase" style={{ color: C.blue }}>
            Sobre o curso
          </h2>
          <div className="mb-3 h-1 w-12 rounded-full" style={{ backgroundColor: C.blue }} />
          <p className="mb-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            O curso Saúde Mental na Educação foi desenvolvido para capacitar profissionais da educação e
            da comunidade escolar para compreender, identificar e manejar questões relacionadas à saúde
            mental no ambiente educacional.
          </p>
          <p className="mb-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Para fortalecer práticas de acolhimento, escuta qualificada e cuidado integral, promovendo
            ambientes escolares mais saudáveis, acolhedores e humanizados.
          </p>
          <div className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <Heart className="mt-0.5 h-6 w-6 shrink-0 text-[#7B2CBF]" />
            <p className="text-sm font-medium leading-relaxed text-slate-700">
              A saúde mental impacta diretamente o desempenho acadêmico, a qualidade do ensino, as
              relações interpessoais e a qualidade de vida no contexto educacional.
            </p>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-extrabold uppercase" style={{ color: C.purple }}>
            Para quem é?
          </h2>
          <div className="mb-3 h-1 w-12 rounded-full" style={{ backgroundColor: C.purple }} />
          <div className="mb-4 flex items-start gap-3">
            <IconCircle icon={Users} color={C.purple} bg="bg-violet-50" />
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Servidores da Rede Municipal de Ensino (REME) e toda a comunidade escolar.
            </p>
          </div>
          <div className="mb-4 flex justify-center gap-2 py-2">
            {[C.blue, C.purple, C.orange, C.green, C.pink].map((color, i) => (
              <div
                key={i}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white shadow-md sm:h-14 sm:w-14"
                style={{ backgroundColor: `${color}22` }}
              >
                <Users className="h-6 w-6" style={{ color }} strokeWidth={1.5} />
              </div>
            ))}
          </div>
          <div
            className="rounded-2xl px-5 py-4 text-white"
            style={{ backgroundColor: C.blueDark }}
          >
            <Quote className="mb-2 h-6 w-6 text-[#F7B500]" fill="#F7B500" />
            <p className="text-sm font-medium leading-relaxed italic sm:text-base">
              Uma formação para todos que acreditam no poder do cuidado, do diálogo e das relações
              saudáveis na escola.
            </p>
          </div>
        </div>
      </section>

      {/* Objetivos */}
      <section className="border-t border-slate-100 bg-slate-50/50 px-5 py-8 sm:px-8">
        <SectionTitle>Objetivos do curso</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {objectives.map((obj) => (
            <div
              key={obj.n}
              className="flex gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-lg font-black"
                  style={{ color: obj.color }}
                >
                  {obj.n}
                </span>
                <IconCircle icon={obj.icon} color={obj.color} bg={obj.bg} size="sm" />
              </div>
              <div>
                <p className="font-bold text-slate-800">{obj.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{obj.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section className="px-5 py-8 sm:px-8">
        <SectionTitle color={C.purple}>Módulos do curso</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <div
              key={mod.n}
              className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white"
                style={{
                  backgroundColor: mod.accent === "yellow" ? C.yellow : C.purple,
                  color: mod.accent === "yellow" ? C.blueDark : "#fff",
                }}
              >
                {mod.n}
              </div>
              <p className="text-xs font-semibold leading-snug text-slate-700 sm:text-sm">{mod.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona + Metodologia */}
      <section className="grid gap-6 border-t border-slate-100 bg-gradient-to-br from-blue-50/40 to-violet-50/30 px-5 py-8 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionTitle>Como funciona?</SectionTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            {flowSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-white bg-white px-3 py-3 shadow-sm">
                  <step.icon className="h-6 w-6 text-[#0F52BA]" />
                  <span className="max-w-[120px] text-center text-xs font-semibold text-slate-700">
                    {step.label}
                  </span>
                </div>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                )}
              </div>
            ))}
          </div>
          <p
            className="mt-5 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
            style={{ backgroundColor: C.blue }}
          >
            Formação que integra teoria e prática, promovendo reflexão, troca de experiências e
            aplicabilidade no cotidiano escolar.
          </p>
        </div>

        <div>
          <SectionTitle color={C.purple}>Metodologia</SectionTitle>
          <ul className="space-y-2.5">
            {methodology.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 sm:text-base">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7B2CBF]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section
        className="flex flex-col items-center gap-6 px-5 py-10 sm:flex-row sm:justify-between sm:px-8"
        style={{ backgroundColor: C.blueDark }}
      >
        <div className="flex max-w-lg items-start gap-4 text-white">
          <SaudeMentalBrainLogo className="hidden h-20 w-auto max-w-[72px] shrink-0 rounded-xl bg-white object-cover object-top sm:block" />
          <div>
            <p className="text-xl font-extrabold uppercase sm:text-2xl">Faça parte dessa transformação!</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
              Amplie seus conhecimentos, fortaleça suas práticas e participe da construção de uma
              educação mais acolhedora e saudável.
            </p>
          </div>
        </div>
        <SaudeMentalInscricaoCta
          status={
            statusQuery.data ?? {
              aberta: true,
              inscricoes_habilitadas: true,
              encerramento_em: null,
              mensagem_encerrada: "",
            }
          }
          loading={statusQuery.isLoading}
        />
      </section>

      {/* Rodapé institucional */}
      <footer className="flex flex-col items-center gap-4 border-t border-slate-100 px-5 py-6 sm:flex-row sm:justify-between sm:px-8">
        <img src="/logo_CPAE.png" alt="CPAE" className="h-10 w-auto object-contain" />
        <p className="max-w-sm text-center text-xs font-medium text-slate-500 sm:text-sm">
          Cuidar, escutar e acolher fazem parte da nossa missão.
        </p>
        <img src="/logo_SEMED.png" alt="SEMED" className="h-10 w-auto object-contain" />
      </footer>
    </article>
  );
}
