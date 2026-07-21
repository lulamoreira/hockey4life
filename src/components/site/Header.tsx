import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";

type TemaMenu = { nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number };

export function Header({ temasMenu }: { temasMenu: TemaMenu[] }) {
  const [open, setOpen] = useState(false);
  const times = temasMenu.filter((t) => t.tipo === "time" && t.destaque_menu);
  const assuntos = temasMenu.filter((t) => t.tipo === "assunto" && t.destaque_menu);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="h4l-title text-2xl leading-none text-primary">HOCKEY</span>
          <span className="h4l-title text-2xl leading-none text-foreground">4LIFE</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {times.slice(0, 5).map((t) => (
            <Link
              key={t.slug}
              to="/time/$slug"
              params={{ slug: t.slug }}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
            >
              {t.nome}
            </Link>
          ))}
          {assuntos.slice(0, 3).map((t) => (
            <Link
              key={t.slug}
              to="/assunto/$slug"
              params={{ slug: t.slug }}
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
            >
              {t.nome}
            </Link>
          ))}
          <Link
            to="/arquivo"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          >
            Arquivo
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/busca"
            className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            to="/fale-conosco"
            className="hidden rounded-md border border-primary/50 bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground md:inline-flex"
          >
            Fale conosco
          </Link>
          <button
            className="rounded-md p-2 text-foreground hover:bg-muted md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-80 max-w-[90%] overflow-y-auto bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="h4l-title text-xl text-primary">MENU</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
              <Link to="/" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted">
                Início
              </Link>
              <Link to="/arquivo" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted">
                Arquivo
              </Link>
              <Link to="/busca" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted">
                Buscar
              </Link>
              <Link to="/fale-conosco" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted">
                Fale conosco
              </Link>

              {times.length > 0 && (
                <div className="mt-4">
                  <div className="px-3 text-xs font-semibold uppercase text-muted-foreground">Times</div>
                  {times.map((t) => (
                    <Link key={t.slug} to="/time/$slug" params={{ slug: t.slug }} onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-muted">
                      {t.nome}
                    </Link>
                  ))}
                </div>
              )}
              {assuntos.length > 0 && (
                <div className="mt-4">
                  <div className="px-3 text-xs font-semibold uppercase text-muted-foreground">Assuntos</div>
                  {assuntos.map((t) => (
                    <Link key={t.slug} to="/assunto/$slug" params={{ slug: t.slug }} onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-muted">
                      {t.nome}
                    </Link>
                  ))}
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}
