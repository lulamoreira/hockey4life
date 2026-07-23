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

  const label = "Editar esta matéria no painel administrativo";
  return (
    <Link
      to="/admin/posts/$id"
      params={{ id: postId }}
      title={label}
      aria-label={label}
      className="group relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Editar no admin
      </span>
    </Link>
  );

}
