import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SaudeMentalBrainLogo } from "@/components/saude-mental/SaudeMentalBrainLogo";

const C = {
  blue: "#0F52BA",
} as const;

export function SaudeMentalCursoButton() {
  return (
    <Link
      to="/saude-mental/curso"
      className="group relative mt-4 block w-full max-w-[280px] overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,82,186,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,82,186,0.2)] sm:mx-auto sm:max-w-[520px] lg:mx-0"
      aria-label="Curso de Saúde Mental na Educação — Saiba mais"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-8 left-0 h-24 w-[70%] rounded-full bg-violet-100/60 blur-2xl" />
        <div className="absolute -bottom-6 right-0 h-20 w-[55%] rounded-full bg-blue-100/70 blur-2xl" />
        <div className="absolute right-4 top-3 grid grid-cols-4 gap-1 opacity-30">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-slate-300" />
          ))}
        </div>
      </div>

      <div className="relative flex min-h-[108px] items-stretch gap-3 px-3 py-3 sm:min-h-[118px] sm:gap-4 sm:px-4 sm:py-3.5">
        {/* Logo cérebro (SVG nítido) */}
        <div className="flex w-[88px] shrink-0 items-center justify-center sm:w-[100px]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_rgba(15,82,186,0.25)] ring-2 ring-white">
            <SaudeMentalBrainLogo className="h-[96px] w-[82px] object-cover object-top sm:h-[104px] sm:w-[90px]" />
          </div>
        </div>

        {/* Título + CTA */}
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="flex flex-1 flex-col justify-center leading-none">
            <p className="text-base font-semibold text-[#0F172A] sm:text-lg">Curso de</p>
            <p
              className="mt-0.5 text-2xl font-extrabold leading-[1.02] sm:text-[28px]"
              style={{ color: C.blue }}
            >
              Saúde Mental
            </p>
            <p className="mt-0.5 text-base font-semibold text-[#0F172A] sm:text-lg">
              na Educação
            </p>
          </div>

          <span
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white transition-colors group-hover:brightness-110 sm:text-sm"
            style={{ backgroundColor: C.blue }}
          >
            Saiba mais
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
