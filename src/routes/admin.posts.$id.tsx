import { createFileRoute } from "@tanstack/react-router";
import { PostEditor } from "@/components/admin/PostEditor";

export const Route = createFileRoute("/admin/posts/$id")({
  component: EditorRoute,
});

function EditorRoute() {
  const { id } = Route.useParams();
  return <PostEditor id={id} />;
}
