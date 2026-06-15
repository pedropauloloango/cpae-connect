import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — CPAE" }, { name: "description", content: "Acesso da equipe CPAE." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");
  const [signupFormKey, setSignupFormKey] = useState(0);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    if (!session || authLoading) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_status")
        .eq("id", session.user.id)
        .maybeSingle();

      const status = profile?.account_status;
      if (status === "aprovado") navigate({ to: "/dashboard" });
      else if (status === "pendente") navigate({ to: "/aguardando-aprovacao" });
    })();
  }, [session, authLoading, navigate]);

  const finishSignUpFlow = () => {
    setVerifyModalOpen(false);
    setTab("signin");
    setSignupFormKey((k) => k + 1);
    setRegisteredEmail("");
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Não foi possível entrar", { description: error.message });

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", data.user!.id)
      .maybeSingle();

    const status = profile?.account_status ?? "pendente";
    if (status === "rejeitado") {
      await supabase.auth.signOut();
      return toast.error("Acesso não autorizado", { description: "Seu cadastro foi rejeitado. Contate a administração." });
    }
    if (status === "pendente") {
      toast.info("Aguardando aprovação", { description: "Um administrador precisa liberar seu acesso." });
      navigate({ to: "/aguardando-aprovacao" });
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: fullName } },
    });
    if (error) {
      setLoading(false);
      return toast.error("Não foi possível criar a conta", { description: error.message });
    }
    if (data.session) await supabase.auth.signOut();
    setLoading(false);
    setRegisteredEmail(email);
    setVerifyModalOpen(true);
  };
  const google = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setLoading(false);
      toast.error("Falha no Google", { description: error.message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao site
        </Link>
        <Link to="/" className="mb-6 flex items-center justify-center gap-3">
          <img src="/icon-192.png" alt="CPAE" className="h-10 w-10 rounded-md" />
          <span className="text-lg font-semibold">Gestão CPAE</span>
        </Link>
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Acesso da equipe</CardTitle>
            <CardDescription>Administradores e profissionais</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    signIn(String(f.get("email")), String(f.get("password")));
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">E-mail</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pass">Senha</Label>
                    <Input id="si-pass" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form
                  key={signupFormKey}
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    signUp(String(f.get("email")), String(f.get("password")), String(f.get("name")));
                  }}
                >                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Nome completo</Label>
                    <Input id="su-name" name="name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Senha</Label>
                    <Input id="su-pass" name="password" type="password" required minLength={6} autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={google} disabled={loading}>
              Continuar com Google
            </Button>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              É da comunidade escolar?{" "}
              <Link to="/acolhimento" className="font-medium text-primary hover:underline">
                Solicitar acolhimento
              </Link>
            </p>
          </CardContent>
        </Card>

        <Dialog
          open={verifyModalOpen}
          onOpenChange={(open) => {
            if (!open) finishSignUpFlow();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center sm:items-center sm:text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <DialogTitle className="mt-2">Confirme seu e-mail</DialogTitle>
              <DialogDescription className="text-center">
                Enviamos um link de confirmação para{" "}
                <span className="font-medium text-foreground">{registeredEmail}</span>.
                Confirme seu e-mail e faça login. Após isso, um administrador deverá aprovar
                seu cadastro e vincular sua permissão.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button className="w-full sm:w-auto" onClick={finishSignUpFlow}>
                Entendi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}