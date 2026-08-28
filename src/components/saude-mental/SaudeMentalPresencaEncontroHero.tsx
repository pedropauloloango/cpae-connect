import { CalendarDays, Clock, MapPin } from "lucide-react";
import { SaudeMentalBrainLogo } from "@/components/saude-mental/SaudeMentalBrainLogo";

const C = {
  blue: "#0F52BA",
  blueDark: "#083D8C",
  purple: "#7B2CBF",
} as const;

type Props = {
  moduloCurso: string;
  data: string;
  horario: string;
  local: string;
};

function formatHorario(value: string): string {
  return String(value).slice(0, 5);
}

function parseDataParts(value: string): { dia: string; mes: string; ano: string; completa: string } {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { dia: "—", mes: "—", ano: "—", completa: value };
  }
  return {
    dia: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
    mes: d.toLocaleDateString("pt-BR", { month: "long" }),
    ano: String(d.getFullYear()),
    completa: d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };
}

export function SaudeMentalPresencaEncontroHero({ moduloCurso, data, horario, local }: Props) {
  const parts = parseDataParts(data);
  const hora = formatHorario(horario);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#083D8C] via-[#0F52BA] to-[#7B2CBF] px-5 py-8 text-white sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-violet-300/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-2xl bg-white p-1 shadow-lg ring-2 ring-white/30">
            <SaudeMentalBrainLogo className="h-16 w-14 object-cover object-top sm:h-[72px] sm:w-16" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">
              Curso de Capacitação
            </p>
            <p className="text-lg font-extrabold leading-tight sm:text-xl">
              Saúde Mental
              <span className="block text-sm font-semibold text-white/90 sm:text-base">na Educação</span>
            </p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            Encontro presencial
          </p>
          <div
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 backdrop-blur-sm"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
          >
            <p
              className="text-xl font-extrabold uppercase leading-tight tracking-wide sm:text-2xl"
              style={{ color: "#F7B500" }}
            >
              {moduloCurso}
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white px-4 py-4 text-left text-[#0F172A] shadow-lg">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: C.purple }}
              >
                <span className="text-lg font-black leading-none">{parts.dia}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data</p>
                <p className="text-sm font-bold capitalize leading-tight text-[#0F172A]">{parts.mes}</p>
                <p className="text-xs font-medium text-slate-500">{parts.ano}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#0F52BA]" />
              {parts.completa}
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 rounded-2xl border border-white/20 bg-white/95 px-4 py-4 text-left text-[#0F172A] shadow-lg">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horário</p>
              <p className="mt-0.5 flex items-center gap-2 text-2xl font-black tabular-nums text-[#7B2CBF]">
                <Clock className="h-5 w-5 shrink-0" />
                {hora}
              </p>
            </div>
            {local?.trim() ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Local</p>
                <p className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold leading-snug text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0F52BA]" />
                  {local}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SaudeMentalPresencaFechadaAlert() {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 px-5 py-6 text-center shadow-[0_8px_30px_rgba(245,158,11,0.2)]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-200/80 text-amber-900 ring-4 ring-amber-100">
          <Clock className="h-7 w-7" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-base font-extrabold uppercase tracking-wide text-amber-950">
            Registro indisponível
          </p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-amber-950/90">
            No momento o registro de presença <strong>não está recebendo confirmações</strong>.
            Aguarde a liberação pela equipe do CPAE.
          </p>
        </div>
        <p className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-amber-900">
          Esta página atualiza automaticamente quando a janela for aberta
        </p>
      </div>
    </div>
  );
}
