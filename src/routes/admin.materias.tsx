import { createFileRoute } from "@tanstack/react-router";
import { PostsListPage } from "@/components/admin/PostsListPage";

export const Route = createFileRoute("/admin/materias")({
  component: PostsListPage,
});