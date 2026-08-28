import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import type { SaudeMentalInscricaoStatus } from "@/lib/saude-mental-inscricao-config";

const C = {
  blueDark: "#083D8C",
  yellow: "#F7B500",
} as const;

type Props = {
  status: SaudeMentalInscricaoStatus;
  loading?: boolean;
};

export function SaudeMentalInscricaoCta({ status, loading }: Props) {
  if (loading) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-2xl px-8 py-4 text-base font-bold opacity-60"
        style={{ backgroundColor: C.yellow, color: C.blueDark }}
      >
        Carregando…
      </span>
    );
  }

  if (status.aberta) {
    return (
      <Link
        to="/saude-mental"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition-all hover:scale-[1.02] hover:brightness-105"
        style={{
          backgroundColor: C.yellow,
          color: C.blueDark,
          boxShadow: "0 10px 30px rgba(247,181,0,0.4)",
        }}
      >
        Inscreva-se agora!
        <ArrowRight className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <div className="flex max-w-sm shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-center text-white">
      <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/90">
        <Lock className="h-4 w-4" />
        Inscrições encerradas
      </span>
      <p className="text-sm leading-relaxed text-white/85">{status.mensagem_encerrada}</p>
    </div>
  );
}
