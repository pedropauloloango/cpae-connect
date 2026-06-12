import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Heart, Calendar, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Sistemas CPAE" },
      { name: "description", content: "Plataforma institucional da CPAE para gestão de Acolhimento e demais sistemas." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="CPAE" className="h-9 w-9 rounded-md" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Gestão de Sistemas</div>
              <div className="text-xs text-muted-foreground">CPAE</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/acolhimento"
              className="hidden sm:inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Solicitar Acolhimento
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Plataforma institucional
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              HUB de sistemas da <span className="text-primary">CPAE</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Unificamos solicitações, acompanhamentos, agenda e indicadores em uma única plataforma —
              substituindo formulários, planilhas e controles manuais.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/acolhimento"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-90"
              >
                Solicitar Acolhimento <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                Acesso da equipe
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Heart, title: "Módulo Acolhimento", text: "Receba solicitações, distribua para profissionais e acompanhe cada caso." },
              { icon: Calendar, title: "Agenda integrada", text: "Visualize atendimentos por dia, semana e mês com FullCalendar." },
              { icon: BarChart3, title: "Indicadores em tempo real", text: "Dashboards executivos por escola, região, profissional e queixa." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 shadow-card">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CPAE — Gestão de Sistemas
      </footer>
    </div>
  );
}
