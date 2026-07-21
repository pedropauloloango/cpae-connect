import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/modulo-vivencias")({
  component: () => <Outlet />,
});
