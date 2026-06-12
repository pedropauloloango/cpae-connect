import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — CPAE" }, { name: "description", content: "Acesso da equipe CPAE." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session && !authLoading) navigate({ to: "/app/dashboard" });
  }, [session, authLoading, navigate]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Não foi possível entrar", { description: error.message });
    toast.success("Bem-vindo!");
    navigate({ to: "/app/dashboard" });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app/dashboard`, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error("Não foi possível criar a conta", { description: error.message });
    toast.success("Conta criada! Verifique seu e-mail.");
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app/dashboard" });
    if (result.error) { setLoading(false); toast.error("Falha no Google", { description: String(result.error.message ?? result.error) }); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
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
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form
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
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    signUp(String(f.get("email")), String(f.get("password")), String(f.get("name")));
                  }}
                >
                  <div className="space-y-1.5">
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
      </div>
    </div>
  );
}
