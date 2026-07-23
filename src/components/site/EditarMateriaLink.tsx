import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { getMyPermissions } from "@/lib/equipe.functions";
import { useAuthSession } from "@/hooks/use-auth";

export function EditarMateriaLink({ postId }: { postId: string }) {
  const { session } = useAuthSession();
  const fetchPerms = useServerFn(getMyPermissions);
  const { data } = useQuery({
    queryKey: ["my-permissions", session?.user.id ?? "anon"],
    queryFn: () => fetchPerms(),
    enabled: !!session,
    staleTime: 60_000,
  });

  if (!session || !data) return null;
  const p = data.perms;
  const podeEditar = data.isAdmin || p.editar_qualquer || p.escrever || p.aprovar;
  if (!podeEditar) return null;

  return (
    <Link
      to="/admin/posts/$id"
      params={{ id: postId }}
      title="Editar esta matéria"
      aria-label="Editar esta matéria"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Link>
  );
}
