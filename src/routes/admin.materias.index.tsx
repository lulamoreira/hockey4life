import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/materias/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/posts" });
  },
});
