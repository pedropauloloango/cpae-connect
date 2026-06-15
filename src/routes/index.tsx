import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Sistemas CPAE" },
      {
        name: "description",
        content: "Plataforma institucional da CPAE para gestão de Acolhimento e demais sistemas.",
      },
    ],
  }),
  component: LandingPage,
});
