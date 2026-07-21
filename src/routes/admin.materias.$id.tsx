import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/materias/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/posts/$id", params: { id: params.id } });
  },
});
