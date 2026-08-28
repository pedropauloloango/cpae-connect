import { Shield, Calendar, Clock, Laptop, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SaudeMentalBrainLogo } from "@/components/saude-mental/SaudeMentalBrainLogo";

const C = {
  blue: "#0F52BA",
  blueDark: "#083D8C",
  purple: "#7B2CBF",
  orange: "#FF8C00",
  green: "#52C41A",
} as const;

type InfoItem = { icon: LucideIcon; color: string; bg: string; label: string; value: string };

const infoItems: InfoItem[] = [
  {
    icon: Clock,
    color: C.purple,
    bg: "bg-violet-50",
    label: "Carga horária",
    value: "100 horas",
  },
  {
    icon: Calendar,
    color: C.blue,
    bg: "bg-blue-50",
    label: "Duração",
    value: "6 meses",
  },
  {
    icon: Users,
    color: C.orange,
    bg: "bg-orange-50",
    label: "Público-alvo",
    value: "Servidores da REME e comunidade escolar",
  },
  {
    icon: Laptop,
    color: C.green,
    bg: "bg-emerald-50",
    label: "Modalidade",
    value: "Encontros presenciais e atividades on-line (Moodle)",
  },
];

function IconCircle({
  icon: Icon,
  color,
  bg,
}: {
  icon: LucideIcon;
  color: string;
  bg: string;
}) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${bg}`}
      style={{ color }}
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
    </div>
  );
}

type SaudeMentalCursoHeroProps = {
  showInfoBar?: boolean;
};

export function SaudeMentalCursoHero({ showInfoBar = true }: SaudeMentalCursoHeroProps) {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-violet-50/40 to-blue-50/50 px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-blue-200/30 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,220px)_1fr_minmax(0,200px)] lg:items-start lg:gap-6">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <SaudeMentalBrainLogo className="h-auto w-full max-w-[200px] object-contain sm:max-w-[220px]" />
          </div>

          <div className="text-center">
            <span
              className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: C.purple }}
            >
              Curso de Capacitação
            </span>
            <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              <span style={{ color: C.blue }}>Saúde Mental</span>
              <br />
              <span style={{ color: C.blueDark }}>na Educação</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium sm:text-lg">
              Uma escola que{" "}
              <span style={{ color: C.blue }} className="font-bold">
                acolhe
              </span>
              ,{" "}
              <span style={{ color: C.purple }} className="font-bold">
                escuta
              </span>{" "}
              e{" "}
              <span style={{ color: C.orange }} className="font-bold">
                cuida
              </span>{" "}
              transforma vidas!
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 lg:items-end">
            <img src="/logo_SEMED.png" alt="SEMED Campo Grande" className="h-14 w-auto object-contain sm:h-16" />
            <div className="flex max-w-[200px] items-start gap-2 rounded-xl border border-violet-100 bg-white/80 p-3 text-left shadow-sm">
              <Shield className="mt-0.5 h-8 w-8 shrink-0 text-[#7B2CBF]" strokeWidth={1.5} />
              <p className="text-xs font-semibold leading-snug text-slate-700">
                Cuidar de quem educa também é cuidar de quem aprende.
              </p>
            </div>
          </div>
        </div>
      </section>

      {showInfoBar && (
        <section className="border-y border-slate-100 bg-slate-50/80 px-4 py-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm"
              >
                <IconCircle icon={item.icon} color={item.color} bg={item.bg} />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-800">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
