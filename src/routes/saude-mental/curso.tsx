import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SaudeMentalCursoFlyer } from "@/components/saude-mental/SaudeMentalCursoFlyer";
import { DalealDeveloperBanner } from "@/components/layout/DalealDeveloperBanner";

export const Route = createFileRoute("/saude-mental/curso")({
  head: () => ({
    meta: [
      { title: "Curso de Saúde Mental na Educação — CPAE" },
      {
        name: "description",
        content:
          "Curso de capacitação Saúde Mental na Educação — CPAE e SEMED Campo Grande.",
      },
    ],
  }),
  component: SaudeMentalCursoPage,
});

function SaudeMentalCursoPage() {
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
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7B2CBF] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-8 lg:py-10">
        <SaudeMentalCursoFlyer />
      </main>

      <DalealDeveloperBanner />

      <div className="mt-2 bg-[#083D8C] px-4 py-6 text-center text-sm text-white/90">
        © {new Date().getFullYear()} CPAE — Coordenadoria Municipal de Psicologia e Assistência
        Educacional
      </div>
    </div>
  );
}
