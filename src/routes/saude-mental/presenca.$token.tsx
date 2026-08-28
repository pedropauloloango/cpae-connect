import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCpfMask } from "@/lib/saude-mental-options";
import {
  confirmarPresencaPorQr,
  getEncontroByQrToken,
} from "@/lib/saude-mental-presenca";
import { DalealDeveloperBanner } from "@/components/layout/DalealDeveloperBanner";
import {
  SaudeMentalPresencaEncontroHero,
  SaudeMentalPresencaFechadaAlert,
} from "@/components/saude-mental/SaudeMentalPresencaEncontroHero";

export const Route = createFileRoute("/saude-mental/presenca/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar presença — Saúde Mental CPAE" },
      {
        name: "description",
        content: "Confirme sua presença no encontro do Curso de Saúde Mental na Educação.",
      },
    ],
  }),
  component: PresencaPublicaPage,
});

const primaryBtn =
  "rounded-[14px] font-semibold text-white transition-all duration-300 ease-in-out shadow-[0_10px_30px_rgba(123,44,191,0.25)] bg-[#7B2CBF] hover:bg-[#5B21B6]";

const formCard =
  "overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_60px_rgba(15,82,186,0.08)]";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-50 h-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-[640px] items-center px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo_CPAE.png" alt="CPAE" className="h-12 w-auto object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">CPAE</p>
              <p className="truncate text-xs text-slate-500">Saúde Mental na Educação</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 py-6 lg:px-8 lg:py-10">{children}</main>
      <DalealDeveloperBanner className="pt-4" />
      <footer className="mt-2 bg-[#083D8C] px-4 py-6 text-center text-sm text-white/90">
        © {new Date().getFullYear()} CPAE — Coordenadoria Municipal de Psicologia e Assistência
        Educacional
      </footer>
    </div>
  );
}

function PresencaPublicaPage() {
  const { token } = Route.useParams();
  const [cpf, setCpf] = useState("");
  const [done, setDone] = useState<{ nome: string | null; ja: boolean; mensagem: string } | null>(
    null,
  );

  const encontroQuery = useQuery({
    queryKey: ["saude-mental-encontro-qr", token],
    queryFn: () => getEncontroByQrToken(token),
    retry: false,
    refetchInterval: (q) => (q.state.data?.recebimento_aberto ? false : 5_000),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmarPresencaPorQr(token, cpf),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.mensagem);
        return;
      }
      setDone({ nome: res.nome_completo, ja: res.ja_registrado, mensagem: res.mensagem });
      toast.success(res.mensagem);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (encontroQuery.isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center rounded-[24px] border border-slate-100 bg-white py-20 text-muted-foreground shadow-sm">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#7B2CBF]" />
          Carregando encontro…
        </div>
      </Shell>
    );
  }

  if (encontroQuery.isError || !encontroQuery.data) {
    return (
      <Shell>
        <Card className={formCard}>
          <CardHeader>
            <CardTitle className="text-lg">QR Code inválido</CardTitle>
            <CardDescription>
              Este link de presença não corresponde a um encontro válido.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Entre em contato com a equipe do CPAE se precisar de ajuda.
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const e = encontroQuery.data;
  const aberto = Boolean(e.recebimento_aberto);

  const hero = (
    <SaudeMentalPresencaEncontroHero
      moduloCurso={e.modulo_curso}
      data={e.data}
      horario={String(e.horario)}
      local={e.local}
    />
  );

  if (done) {
    return (
      <Shell>
        <article className={formCard}>
          {hero}
          <div className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-[#0F172A]">
                {done.ja ? "Presença já registrada" : "Presença confirmada!"}
              </p>
              {done.nome && (
                <p className="mt-2 text-base text-[#64748B]">
                  Olá, <strong className="text-[#0F52BA]">{done.nome}</strong>
                </p>
              )}
              <p className="mt-2 text-sm text-[#64748B]">{done.mensagem}</p>
            </div>
          </div>
        </article>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className={formCard}>
        {hero}

        <section className="space-y-5 px-5 py-8 sm:px-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-[#0F172A]">Confirmar presença</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Informe o CPF utilizado na inscrição do curso.
            </p>
          </div>

          {!aberto ? (
            <SaudeMentalPresencaFechadaAlert />
          ) : (
            <div className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="font-semibold text-[#0F172A]">
                  CPF do inscrito *
                </Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(ev) => setCpf(formatCpfMask(ev.target.value))}
                  className="rounded-xl border-slate-200 bg-white"
                />
              </div>
              <Button
                type="button"
                className={`w-full ${primaryBtn}`}
                disabled={confirmMut.isPending || cpf.replace(/\D/g, "").length < 11}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar presença
              </Button>
            </div>
          )}
        </section>
      </article>
    </Shell>
  );
}
