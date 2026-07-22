import { Link } from "@tanstack/react-router";
import { formatDataBR } from "@/lib/slugify";
import type { PostListItem } from "@/lib/posts.functions";

export function PostCard({ post }: { post: PostListItem }) {
  const tema = post.temas?.[0];
  const chapeu = post.chapeu?.trim();
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
        {chapeu ? (
          <span className="absolute left-3 top-3 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {chapeu}
          </span>
        ) : tema ? (
          <span className="absolute left-3 top-3 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {tema.nome}
          </span>
        ) : null}
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
  const dataExtenso = (() => {
    if (!post.publicado_em) return "";
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(post.publicado_em));
    } catch {
      return formatDataBR(post.publicado_em);
    }
  })();

  return (
    <Link
      to="/$slug"
      params={{ slug: post.slug }}
      className="group flex gap-3 border-b border-border/60 p-3 transition-colors last:border-b-0 hover:bg-white/5"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
        {post.imagem_capa ? (
          <img
            src={post.imagem_capa}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="h4l-title text-lg text-muted-foreground/40">H4L</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{dataExtenso}</span>
          {tema && (
            <>
              <span aria-hidden="true" className="text-muted-foreground/50">|</span>
              <span className="font-semibold text-primary">{tema.nome}</span>
            </>
          )}
        </div>
        <h4 className="mt-1 line-clamp-3 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {post.titulo}
        </h4>
      </div>
    </Link>
  );
}

