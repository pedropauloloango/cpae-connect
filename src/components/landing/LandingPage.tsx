import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  GraduationCap,
  HandHeart,
  Heart,
  Lock,
  Menu,
  Quote,
  School,
  Shield,
  ShieldCheck,
  Smile,
  UserCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const CPAE_COLORS = {
  primary: "#0F52BA",
  primaryHover: "#083D8C",
  purple: "#7B2CBF",
  pink: "#D633C6",
  green: "#52C41A",
  yellow: "#F7B500",
  orange: "#FF8C00",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  badgeBg: "#EAF2FF",
  quemSomos: "#F6F9FF",
  trabalhos: "#F2FFF6",
  atuacao: "#FAF5FF",
} as const;

const navLinks = [
  { label: "Início", href: "#inicio", external: true },
  { label: "Agenda", href: "#modulos", external: true },
  { label: "Indicadores", href: "#modulos", external: true },
  { label: "Equipe", href: "#equipe", external: true },
  { label: "Sobre o CPAE", href: "#sobre", external: true },
] as const;

const highlights = [
  { icon: Heart, emoji: "❤", iconBg: "bg-[#FAF5FF] text-[#D633C6]", title: "Acolhimento", text: "Individual e humanizado" },
  { icon: Users, emoji: "👥", iconBg: "bg-[#F2FFF6] text-[#52C41A]", title: "Atuação Multidisciplinar", text: "Psicólogos, Psicopedagogos e Educadores Físicos" },
  { icon: Smile, emoji: "😊", iconBg: "bg-[#FFFBEB] text-[#F7B500]", title: "Foco Socioemocional", text: "Desenvolvimento integral dos alunos da REME" },
  { icon: Shield, emoji: "🛡", iconBg: "bg-[#EAF2FF] text-[#0F52BA]", title: "Sigilo e Ética", text: "Atendimento ético, seguro e responsável" },
] as const;

const modules = [
  { icon: HandHeart, title: "Módulo Acolhimento", text: "Receba solicitações, distribua para profissionais e acompanhe cada caso com rastreabilidade completa." },
  { icon: Calendar, title: "Agenda Integrada", text: "Visualize atendimentos por dia, semana e mês com calendário unificado para toda a equipe." },
  { icon: BarChart3, title: "Indicadores em Tempo Real", text: "Dashboards executivos por escola, região, profissional e queixa para apoiar a gestão." },
] as const;

const teamRoles = ["Psicólogos", "Psicopedagogos", "Professores de Educação Física"] as const;

const trabalhos = [
  "Acolhimento individual",
  "Promoção da saúde física e mental",
  "Fortalecimento da comunidade escolar",
  "Encaminhamentos assertivos",
  "Psicoeducação",
] as const;

const atuacao = {
  alunos: ["Uso e abuso de telas", "Habilidades socioemocionais", "Identidade e Autoconhecimento", "Bullying e Cyberbullying", "Projeto de Vida", "Setembro Amarelo"],
  pais: ["Uso e abuso de telas", "Família presente", "Adultização infantil", "Palestras e orientações"],
  servidores: ["Saúde mental", "Autocuidado", "Vivências coletivas", "Formação continuada"],
  transversais: ["Motivação", "Ética", "Relacionamento interpessoal", "Comunicação clara", "Saúde mental"],
} as const;

const valores = [
  { icon: ShieldCheck, label: "Sigilo e Ética" },
  { icon: Heart, label: "Atendimento Humanizado" },
  { icon: School, label: "Integração com Escolas" },
  { icon: Lock, label: "LGPD" },
  { icon: GraduationCap, label: "Desenvolvimento Integral do aluno" },
] as const;

const primaryBtn =
  "rounded-[14px] px-7 py-4 text-base font-semibold text-white transition-all duration-300 ease-in-out shadow-[0_10px_30px_rgba(15,82,186,0.2)] bg-[#0F52BA] hover:bg-[#083D8C]";

const cardShadow = "shadow-[0_10px_40px_rgba(0,0,0,0.05)]";
const elevatedShadow = "shadow-[0_20px_40px_rgba(15,23,42,0.08)]";

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-white text-[#0F172A] antialiased"
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

          <nav className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map((item) => (
              <NavItem key={item.label} item={item} className="px-3 py-2 text-sm font-medium text-[#64748B] transition-all duration-300 hover:text-[#0F52BA]" />
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <Button
              variant="ghost"
              className="rounded-[14px] text-[#0F52BA] hover:bg-[#EAF2FF] hover:text-[#083D8C]"
              asChild
            >
              <Link to="/auth">
                <UserCircle className="mr-2 h-4 w-4" />
                Acesso da Equipe
              </Link>
            </Button>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
              <SheetHeader>
                <SheetTitle className="text-left text-[#0F172A]">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((item) => (
                  <SheetClose key={item.label} asChild>
                    <NavItem
                      item={item}
                      className="rounded-xl px-4 py-3 text-base font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                      onClick={() => setMenuOpen(false)}
                    />
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-8 flex flex-col gap-3">
                <SheetClose asChild>
                  <Button variant="outline" className="w-full rounded-[14px]" asChild>
                    <Link to="/auth">Acesso da Equipe</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative bg-[url('/cpae-hero-bg.png')] bg-cover bg-center bg-no-repeat px-5 py-20 md:min-h-[600px] md:py-16 lg:min-h-[700px] lg:px-8 lg:py-20"
        >
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
                style={{ background: CPAE_COLORS.badgeBg, color: CPAE_COLORS.primary }}
              >
                <span aria-hidden>🛡</span> Plataforma Institucional
              </span>

              <h1 className="mt-6 text-[38px] font-extrabold leading-[1.1] tracking-tight text-[#0F172A] lg:text-[64px]">
                Gestão de sistemas
                <br />
                da <span className="text-[#0F52BA]">CPAE</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-[18px] font-normal leading-relaxed text-[#64748B] lg:mx-0 lg:text-[22px]">
                Unificamos solicitações, acompanhamentos, agenda e indicadores em uma única plataforma,
                substituindo formulários, planilhas e controles manuais.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link to="/acolhimento" className={`w-full sm:w-auto ${primaryBtn} inline-flex items-center justify-center gap-2`}>
                  Solicitar Acolhimento
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#equipe"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#0F52BA]/20 bg-white/80 px-7 py-4 text-base font-semibold text-[#0F52BA] backdrop-blur-sm transition-all duration-300 hover:border-[#0F52BA]/40 hover:bg-[#EAF2FF] sm:w-auto"
                >
                  <Users className="h-4 w-4" />
                  Conhecer a equipe
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center lg:items-end">
              <div className="flex flex-col items-center gap-6 sm:flex-row lg:gap-8">
                <img
                  src="/logo_CPAE.png"
                  alt="Logo CPAE — Coordenadoria Municipal de Psicologia e Assistência Educacional"
                  className="h-auto w-full max-w-[280px] object-contain drop-shadow-[0_25px_40px_rgba(0,0,0,0.12)] sm:max-w-[340px] lg:max-h-[450px] lg:max-w-[450px]"
                />
                <div className="text-left">
                  <p className="text-5xl font-extrabold tracking-tight text-[#0F172A] lg:text-6xl">CPAE</p>
                  <p className="mt-2 text-sm font-semibold uppercase leading-tight tracking-wide text-[#4a5568] sm:text-base">
                    Coordenadoria Municipal de
                    <br />
                    Psicologia e Assistência
                    <br />
                    Educacional
                  </p>
                </div>
              </div>
              <div className="mt-8 flex justify-center lg:justify-end">
                <img
                  src="/logo_SEMED.png"
                  alt="SEMED — Prefeitura de Campo Grande"
                  className="h-auto w-full max-w-[220px] object-contain sm:max-w-[260px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-10 lg:px-8 lg:py-12">
          <div
            className={`mx-auto max-w-[1280px] rounded-[20px] bg-white p-6 ${cardShadow} transition-all duration-300 lg:p-8`}
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg ${item.iconBg}`}>
                    <span aria-hidden>{item.emoji}</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#0F172A]">{item.title}</p>
                    <p className="mt-1 text-sm leading-snug text-[#64748B]">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="modulos" className="bg-[#F8FAFC] px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-[#0F172A] lg:text-3xl">Módulos do Sistema</h2>
            <p className="mt-2 text-[#64748B]">Ferramentas integradas para acolhimento, agenda e gestão.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <div
                key={mod.title}
                className={`group flex min-h-[160px] flex-col rounded-[20px] border border-slate-100 bg-white p-6 ${elevatedShadow} transition-all duration-300 ease-in-out hover:-translate-y-2`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#0F52BA] transition-colors duration-300 group-hover:bg-[#0F52BA] group-hover:text-white">
                  <mod.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-[#0F172A]">{mod.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{mod.text}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        <section id="sobre" className="bg-white px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-3">
            <div
              id="equipe"
              className={`relative overflow-hidden rounded-[20px] border border-blue-100/60 p-6 lg:p-8 ${elevatedShadow}`}
              style={{ background: CPAE_COLORS.quemSomos }}
            >
              <h2 className="text-xl font-bold text-[#0F52BA]">Quem somos</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#64748B] lg:text-base">
                Coordenadoria com equipe multidisciplinar voltada ao desenvolvimento das habilidades
                socioemocionais dos alunos da REME.
              </p>
              <p className="mt-6 text-sm font-bold text-[#0F172A]">Nossa equipe</p>
              <ul className="mt-3 space-y-2.5">
                {teamRoles.map((role) => (
                  <li key={role} className="flex items-center gap-2.5 text-sm text-[#0F172A]">
                    <Check className="h-4 w-4 shrink-0 text-[#0F52BA]" strokeWidth={3} />
                    {role}
                  </li>
                ))}
              </ul>
              <Users className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 text-[#0F52BA]/[0.06]" />
            </div>

            <div
              className={`rounded-[20px] border border-emerald-100/60 p-6 lg:p-8 ${elevatedShadow}`}
              style={{ background: CPAE_COLORS.trabalhos }}
            >
              <h2 className="text-xl font-bold text-[#15803d]">Trabalhos desenvolvidos</h2>
              <ul className="mt-5 space-y-3">
                {trabalhos.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[#0F172A]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#52C41A]" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
              <div
                className="mt-6 flex gap-3 rounded-2xl border border-[#52C41A]/20 p-4"
                style={{ background: "rgba(82, 196, 26, 0.08)" }}
              >
                <Quote className="h-8 w-8 shrink-0 text-[#52C41A]" />
                <p className="text-sm font-semibold italic leading-relaxed text-[#166534]">
                  &ldquo;Nenhum de nós é tão bom quanto todos nós juntos!&rdquo;
                </p>
              </div>
            </div>

            <div
              className={`rounded-[20px] border border-violet-100/60 p-6 lg:p-8 ${elevatedShadow}`}
              style={{ background: CPAE_COLORS.atuacao }}
            >
              <h2 className="text-xl font-bold text-[#7B2CBF]">Atuação</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <AtuacaoList title="Para Alunos" items={atuacao.alunos} accent="#7B2CBF" />
                <AtuacaoList title="Para Pais" items={atuacao.pais} accent="#D633C6" />
                <AtuacaoList title="Para Servidores" items={atuacao.servidores} accent="#7B2CBF" />
                <AtuacaoList title="Temas Transversais" items={atuacao.transversais} accent="#D633C6" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F8FAFC] px-4 py-12 lg:px-8">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {valores.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF2FF] text-[#0F52BA] transition-transform duration-300 hover:scale-105">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="max-w-[10rem] text-xs font-semibold leading-snug text-[#64748B]">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#083D8C] px-4 py-10 text-center text-sm text-white/90">
        © {new Date().getFullYear()} CPAE — Coordenadoria Municipal de Psicologia e Assistência Educacional
      </footer>
    </div>
  );
}

function NavItem({
  item,
  className,
  onClick,
}: {
  item: (typeof navLinks)[number];
  className?: string;
  onClick?: () => void;
}) {
  if (item.external) {
    return (
      <a href={item.href} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}

function AtuacaoList({
  title,
  items,
  accent,
}: {
  title: string;
  items: readonly string[];
  accent: string;
}) {
  return (
    <div>
      <p className="text-sm font-bold" style={{ color: accent }}>
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs leading-relaxed text-[#64748B]">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
