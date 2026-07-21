import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function NaoPercaTicker({
  items,
}: {
  items: Array<{ id: string; titulo: string; slug: string }>;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items || items.length === 0) return null;
  const current = items[idx];

  return (
    <div className="bg-destructive text-destructive-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <span className="h4l-title shrink-0 text-xs tracking-widest">NÃO PERCA</span>
        <span className="h-4 w-px bg-destructive-foreground/40" />
        <Link
          to="/$slug"
          params={{ slug: current.slug }}
          key={current.id}
          className="line-clamp-1 animate-in fade-in font-medium hover:underline"
        >
          {current.titulo}
        </Link>
      </div>
    </div>
  );
}
