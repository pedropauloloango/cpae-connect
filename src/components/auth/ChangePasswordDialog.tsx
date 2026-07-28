import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se true, o diálogo não pode ser fechado sem trocar a senha. */
  required?: boolean;
  userId: string;
  onSuccess?: () => void;
};

export function ChangePasswordDialog({
  open,
  onOpenChange,
  required = false,
  userId,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setPassword("");
    setConfirm("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && required) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const submit = async () => {
    if (password.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId);
      if (profileError) {
        console.error("clear must_change_password", profileError);
      }

      toast.success("Senha atualizada com sucesso.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error("Não foi possível alterar a senha", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton={required}
        onPointerDownOutside={(e) => {
          if (required) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (required) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{required ? "Defina uma nova senha" : "Alterar senha"}</DialogTitle>
          <DialogDescription>
            {required
              ? "Por segurança, troque a senha temporária recebida por e-mail antes de continuar."
              : "Informe a nova senha para a sua conta."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {!required && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
