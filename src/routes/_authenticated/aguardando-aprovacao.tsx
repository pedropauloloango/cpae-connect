import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/aguardando-aprovacao")({
  component: AguardandoAprovacao,
});

function AguardandoAprovacao() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft via-background to-accent/10 p-4">
      <Card className="w-full max-w-md text-center shadow-elegant">
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Clock className="h-7 w-7" />
          </div>
          <CardTitle className="mt-4">Aguardando aprovação</CardTitle>
          <CardDescription className="text-balance">
            Seu e-mail foi confirmado, mas o acesso ao sistema ainda não está liberado.
            Um administrador precisa aprovar seu cadastro e vincular sua permissão como
            <strong> Administrador</strong> ou <strong> Profissional</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Você receberá acesso assim que a aprovação for concluída. Tente entrar novamente depois.
          </p>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
