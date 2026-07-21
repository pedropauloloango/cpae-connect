import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/modulo-vivencias/")({
  beforeLoad: () => {
    throw redirect({ to: "/modulo-vivencias/dashboard" });
  },
});
