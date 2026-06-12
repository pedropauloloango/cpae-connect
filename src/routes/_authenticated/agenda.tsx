import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { meetingTypeLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/agenda")({ component: Agenda });

function Agenda() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: myProfId } = useQuery({
    queryKey: ["my-pro", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("professionals").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, titulo, tipo, inicio, fim, observacoes, professional:professionals(nome)")
        .order("inicio");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id, title: `${a.titulo} (${meetingTypeLabels[a.tipo]})`,
        start: a.inicio, end: a.fim, extendedProps: { observacoes: a.observacoes, professional: a.professional },
      }));
    },
  });

  const createMut = useMutation({
    mutationFn: async (v: { titulo: string; tipo: string; inicio: string; fim: string; observacoes: string }) => {
      const { error } = await supabase.from("appointments").insert({
        titulo: v.titulo, tipo: v.tipo as "acolhimento",
        inicio: v.inicio, fim: v.fim, observacoes: v.observacoes || null,
        professional_id: myProfId ?? null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Compromisso criado"); qc.invalidateQueries({ queryKey: ["appointments"] }); setOpen(false); },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={isAdmin ? "Todos os atendimentos da equipe." : "Sua agenda pessoal."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  createMut.mutate({
                    titulo: String(f.get("titulo")), tipo: String(f.get("tipo")),
                    inicio: String(f.get("inicio")), fim: String(f.get("fim")),
                    observacoes: String(f.get("obs") ?? ""),
                  });
                }}
              >
                <div className="space-y-1.5"><Label>Título *</Label><Input name="titulo" required /></div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select name="tipo" defaultValue="acolhimento">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(meetingTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Início *</Label><Input name="inicio" type="datetime-local" required /></div>
                  <div className="space-y-1.5"><Label>Fim *</Label><Input name="fim" type="datetime-local" required /></div>
                </div>
                <div className="space-y-1.5"><Label>Observações</Label><Textarea name="obs" rows={2} /></div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>Salvar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-3 sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={ptBr}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={events}
            height="auto"
            editable
            selectable
          />
        </CardContent>
      </Card>
    </div>
  );
}
