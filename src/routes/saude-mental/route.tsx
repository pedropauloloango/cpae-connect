import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/saude-mental")({
  component: () => <Outlet />,
});
