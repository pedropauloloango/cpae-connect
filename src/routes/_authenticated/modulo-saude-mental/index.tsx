import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/modulo-saude-mental/")({
  beforeLoad: () => {
    throw redirect({ to: "/modulo-saude-mental/inscritos" });
  },
});
