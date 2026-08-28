import { cn } from "@/lib/utils";

type DalealDeveloperBannerProps = {
  className?: string;
};

export function DalealDeveloperBanner({ className }: DalealDeveloperBannerProps) {
  return (
    <section className={cn("relative z-10 px-4 pb-2 pt-6", className)}>
      <div className="mx-auto flex justify-center">
        <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-center shadow-[0_12px_32px_rgba(15,23,42,0.1)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.14)] sm:max-w-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#64748B]">
            Desenvolvido por
          </p>
          <img
            src="/email/daleal-assinatura.png"
            alt="DALEAL Tecnologia — Transformando ideias em soluções inteligentes"
            className="h-auto w-full max-w-[300px] object-contain"
          />
        </div>
      </div>
    </section>
  );
}
