import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type TemaMenu = { nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number };

export type MenuCabecalho = { arquivo: boolean; busca: boolean; fale_conosco: boolean };
export const MENU_CABECALHO_PADRAO: MenuCabecalho = { arquivo: true, busca: true, fale_conosco: true };
export function normalizeMenuCabecalho(v: any): MenuCabecalho {
  const o = v && typeof v === "object" ? v : {};
  return {
    arquivo: o.arquivo !== false,
    busca: o.busca !== false,
    fale_conosco: o.fale_conosco !== false,
  };
}

const MAX_TIMES = 5;
const MAX_ASSUNTOS = 3;

export function Header({ temasMenu, menu, loading }: { temasMenu: TemaMenu[]; menu?: MenuCabecalho; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = menu ?? MENU_CABECALHO_PADRAO;

  const times = temasMenu.filter((t) => t.tipo === "time" && t.destaque_menu).slice(0, MAX_TIMES);
  const assuntos = temasMenu.filter((t) => t.tipo === "assunto" && t.destaque_menu).slice(0, MAX_ASSUNTOS);
  const carregando = loading === true;


  const isTemaAtivo = (tipo: "time" | "assunto", slug: string) =>
    pathname === `/${tipo}/${slug}`;
  const isArquivoAtivo = pathname === "/arquivo" || pathname.startsWith("/arquivo/");

  const linkBase =
    "text-sm font-semibold uppercase tracking-wide transition-colors hover:text-primary";
  const linkInativo = "text-muted-foreground";
  const linkAtivo = "text-primary";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />

        {/* min-h reserva espaço enquanto os temas carregam para não pular */}
        <nav className="hidden min-h-[24px] items-center gap-6 md:flex" aria-label="Menu principal">
          {carregando ? (
            <SkeletonMenu />
          ) : (
            <>
              {times.map((t) => {
                const ativo = isTemaAtivo("time", t.slug);
                return (
                  <Link
                    key={t.slug}
                    to="/time/$slug"
                    params={{ slug: t.slug }}
                    aria-current={ativo ? "page" : undefined}
                    className={`${linkBase} ${ativo ? linkAtivo : linkInativo}`}
                  >
                    {t.nome}
                  </Link>
                );
              })}
              {assuntos.map((t) => {
                const ativo = isTemaAtivo("assunto", t.slug);
                return (
                  <Link
                    key={t.slug}
                    to="/assunto/$slug"
                    params={{ slug: t.slug }}
                    aria-current={ativo ? "page" : undefined}
                    className={`${linkBase} ${ativo ? linkAtivo : linkInativo}`}
                  >
                    {t.nome}
                  </Link>
                );
              })}
              {m.arquivo && (
                <Link
                  to="/arquivo"
                  aria-current={isArquivoAtivo ? "page" : undefined}
                  className={`${linkBase} ${isArquivoAtivo ? linkAtivo : linkInativo}`}
                >
                  Arquivo
                </Link>
              )}

            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {m.busca && (
            <Link
              to="/busca"
              className={`hidden rounded-md p-2 transition-colors hover:bg-muted hover:text-foreground md:inline-flex ${pathname === "/busca" ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Buscar"
              aria-current={pathname === "/busca" ? "page" : undefined}
            >
              <Search className="h-4 w-4" />
            </Link>
          )}
          <ThemeToggle className="hidden md:inline-flex" />
          {m.fale_conosco && (
            <Link
              to="/fale-conosco"
              aria-current={pathname === "/fale-conosco" ? "page" : undefined}
              className={`hidden rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors md:inline-flex ${
                pathname === "/fale-conosco"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/50 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
            >
              Fale conosco
            </Link>
          )}
          <ThemeToggle className="md:hidden" />
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
              <MobileLink to="/" pathname={pathname} onClick={() => setOpen(false)}>Início</MobileLink>
              {m.arquivo && <MobileLink to="/arquivo" pathname={pathname} onClick={() => setOpen(false)}>Arquivo</MobileLink>}
              {m.busca && <MobileLink to="/busca" pathname={pathname} onClick={() => setOpen(false)}>Buscar</MobileLink>}
              {m.fale_conosco && <MobileLink to="/fale-conosco" pathname={pathname} onClick={() => setOpen(false)}>Fale conosco</MobileLink>}


              {times.length > 0 && (
                <div className="mt-4">
                  <div className="px-3 text-xs font-semibold uppercase text-muted-foreground">Times</div>
                  {times.map((t) => {
                    const ativo = isTemaAtivo("time", t.slug);
                    return (
                      <Link key={t.slug} to="/time/$slug" params={{ slug: t.slug }} onClick={() => setOpen(false)}
                        aria-current={ativo ? "page" : undefined}
                        className={`block rounded px-3 py-2 text-sm hover:bg-muted ${ativo ? "text-primary" : ""}`}>
                        {t.nome}
                      </Link>
                    );
                  })}
                </div>
              )}
              {assuntos.length > 0 && (
                <div className="mt-4">
                  <div className="px-3 text-xs font-semibold uppercase text-muted-foreground">Assuntos</div>
                  {assuntos.map((t) => {
                    const ativo = isTemaAtivo("assunto", t.slug);
                    return (
                      <Link key={t.slug} to="/assunto/$slug" params={{ slug: t.slug }} onClick={() => setOpen(false)}
                        aria-current={ativo ? "page" : undefined}
                        className={`block rounded px-3 py-2 text-sm hover:bg-muted ${ativo ? "text-primary" : ""}`}>
                        {t.nome}
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}

function MobileLink({ to, pathname, onClick, children }: { to: "/" | "/arquivo" | "/busca" | "/fale-conosco"; pathname: string; onClick: () => void; children: React.ReactNode }) {
  const ativo = pathname === to || (to === "/arquivo" && pathname.startsWith("/arquivo/"));
  return (
    <Link to={to} onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted ${ativo ? "text-primary" : ""}`}>
      {children}
    </Link>
  );
}

function SkeletonMenu() {
  // 4 placeholders com largura semelhante aos rótulos reais.
  return (
    <>
      {[64, 72, 80, 64].map((w, i) => (
        <span key={i} aria-hidden="true"
          className="inline-block h-4 rounded bg-muted/40"
          style={{ width: `${w}px` }} />
      ))}
    </>
  );
}
