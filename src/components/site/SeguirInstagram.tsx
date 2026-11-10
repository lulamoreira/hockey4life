import { useQuery } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { getSiteConfig } from "@/lib/posts.functions";

/** Chamada para seguir o Instagram oficial. Lê o link de Configurações → redes sociais; some se estiver vazio. */
export function SeguirInstagram({ className = "" }: { className?: string }) {
  const q = useQuery({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });
  const url: string | undefined = (q.data as any)?.config?.redes_sociais?.instagram;
  if (!url) return null;
  const handle = "@" + (url.replace(/\/+$/, "").split("/").pop() ?? "hockey4lifebr");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-4 rounded-lg border border-primary/40 bg-card/60 p-4 backdrop-blur-sm transition-colors hover:border-primary ${className}`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Instagram className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Siga no Instagram</span>
        <span className="block truncate text-lg font-bold text-foreground group-hover:text-primary">{handle}</span>
        <span className="block text-sm text-muted-foreground">Histórias de vida e superação no hóquei, todo dia.</span>
      </span>
      <span className="hidden shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground sm:inline">Seguir</span>
    </a>
  );
}
