import { Link } from "@tanstack/react-router";
import { formatDataBR } from "@/lib/slugify";
import type { PostListItem } from "@/lib/posts.functions";

export function PostCard({ post }: { post: PostListItem }) {
  const tema = post.temas?.[0];
  return (
    <Link
      to="/$slug"
      params={{ slug: post.slug }}
      className="group h4l-card block overflow-hidden rounded-lg hover:[--tw:0] group-hover:border-primary/50"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {post.imagem_capa ? (
          <img
            src={post.imagem_capa}
            alt={post.titulo}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="h4l-title text-4xl text-muted-foreground/40">H4L</span>
          </div>
        )}
        {tema && (
          <span className="absolute left-3 top-3 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {tema.nome}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {formatDataBR(post.publicado_em)}
        </div>
        <h3 className="mt-1 h4l-title text-xl leading-tight text-foreground transition-colors group-hover:text-primary">
          {post.titulo}
        </h3>
        {post.resumo && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.resumo}</p>
        )}
      </div>
    </Link>
  );
}

export function PostCardSmall({ post }: { post: PostListItem }) {
  const tema = post.temas?.[0];
  return (
    <Link to="/$slug" params={{ slug: post.slug }} className="group block border-b border-border py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {tema && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">{tema.nome}</span>}
        <span>{formatDataBR(post.publicado_em)}</span>
      </div>
      <h4 className="mt-1 h4l-title text-lg leading-tight text-foreground transition-colors group-hover:text-primary">
        {post.titulo}
      </h4>
    </Link>
  );
}
