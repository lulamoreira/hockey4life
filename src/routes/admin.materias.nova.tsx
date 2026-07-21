import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/materias/nova")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/posts/novo" });
  },
});
