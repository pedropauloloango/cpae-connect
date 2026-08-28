import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Brain, CheckCircle2, Loader2 } from "lucide-react";
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

function formatHorario(value: string): string {
  return String(value).slice(0, 5);
}

function formatDataBr(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-50 h-20 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
            <img src="/logo_CPAE.png" alt="CPAE" className="h-12 w-auto object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">CPAE</p>
              <p className="truncate text-xs text-slate-500">Confirmação de presença</p>
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
      <main className="mx-auto max-w-[480px] px-4 py-8 lg:px-8 lg:py-12">{children}</main>
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
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando encontro…
        </div>
      </Shell>
    );
  }

  if (encontroQuery.isError || !encontroQuery.data) {
    return (
      <Shell>
        <Card className="rounded-[20px] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">QR Code inválido</CardTitle>
            <CardDescription>
              Este link de presença não corresponde a um encontro válido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full rounded-[14px]">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const e = encontroQuery.data;
  const aberto = Boolean(e.recebimento_aberto);

  if (done) {
    return (
      <Shell>
        <Card className="rounded-[20px] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div>
              <p className="text-xl font-bold text-[#0F172A]">
                {done.ja ? "Presença já registrada" : "Presença confirmada"}
              </p>
              {done.nome && (
                <p className="mt-2 text-sm text-[#64748B]">
                  Olá, <strong>{done.nome}</strong>
                </p>
              )}
              <p className="mt-1 text-sm text-[#64748B]">{done.mensagem}</p>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="rounded-[20px] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.05)]">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Brain className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Confirmar presença</CardTitle>
          <CardDescription>
            {e.modulo_curso} · {formatDataBr(e.data)} · {formatHorario(String(e.horario))} ·{" "}
            {e.local}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aberto ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              O recebimento de presença ainda não foi liberado ou a janela já encerrou. Aguarde a
              liberação pela equipe do CPAE.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF do inscrito</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(ev) => setCpf(formatCpfMask(ev.target.value))}
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
            </>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
