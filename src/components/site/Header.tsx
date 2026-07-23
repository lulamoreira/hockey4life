import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, Menu, PenSquare, Search, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { MeSurpreenda } from "./MeSurpreenda";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { getMyRole } from "@/lib/admin.functions";

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
  const router = useRouter();
  const m = menu ?? MENU_CABECALHO_PADRAO;

  const { session } = useAuthSession();
  const logado = !!session;
  const roleQ = useQuery({
    queryKey: ["my-role", session?.user.id ?? "anon"],
    queryFn: () => getMyRole(),
    enabled: logado,
    retry: false,
    staleTime: 60_000,
  });
  const isAdmin = !!roleQ.data?.isAdmin;
  const isEditor = !!roleQ.data?.isEditor;

  const perfilQ = useQuery({
    queryKey: ["header-perfil", session?.user.id ?? "anon"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("foto_url,nome").eq("id", session!.user.id).maybeSingle();
      return data as { foto_url: string | null; nome: string | null } | null;
    },
    enabled: logado,
    staleTime: 60_000,
  });
  const fotoUrl = perfilQ.data?.foto_url ?? null;

  async function sair() {
    setOpen(false);
    await supabase.auth.signOut();
    router.invalidate();
  }

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
    <>
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
          <ThemeToggle />
          {logado ? (
            <Link
              to="/conta"
              aria-label="Minha conta"
              title="Minha conta"
              aria-current={pathname === "/conta" ? "page" : undefined}
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </Link>
          ) : (
            <Link
              to="/entrar"
              aria-label="Entrar"
              aria-current={pathname === "/entrar" ? "page" : undefined}
              className={`hidden min-h-9 items-center rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors md:inline-flex ${pathname === "/entrar" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Entrar
            </Link>
          )}
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
          <button
            className="rounded-md p-2 text-foreground hover:bg-muted md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

      </div>

    </header>
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
            <nav className="mt-6 flex flex-col gap-1" aria-label="Menu de navegação">
              <SecaoMenu>Navegar</SecaoMenu>
              <MobileLink to="/" pathname={pathname} onClick={() => setOpen(false)}>Início</MobileLink>
              {m.arquivo && <MobileLink to="/arquivo" pathname={pathname} onClick={() => setOpen(false)}>Arquivo</MobileLink>}
              <MobileLink to="/busca" pathname={pathname} onClick={() => setOpen(false)}>Buscar</MobileLink>
              <Link
                to="/autor/$slug"
                params={{ slug: "diogo-finelli" }}
                onClick={() => setOpen(false)}
                aria-current={pathname === "/autor/diogo-finelli" ? "page" : undefined}
                className={`rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted ${pathname === "/autor/diogo-finelli" ? "text-primary" : ""}`}
              >
                Sobre o autor
              </Link>
              <MobileLink to="/fale-conosco" pathname={pathname} onClick={() => setOpen(false)}>Fale conosco</MobileLink>
              <MobileLink to="/fale-conosco" pathname={pathname} onClick={() => setOpen(false)}>Contato</MobileLink>

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

              <div className="mt-6 border-t border-border pt-4">
                <SecaoMenu>Conta</SecaoMenu>
                {!logado && (
                  <Link
                    to="/entrar"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted"
                  >
                    <LogIn className="h-4 w-4" /> Entrar
                  </Link>
                )}
                {logado && (
                  <Link
                    to="/conta"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted"
                  >
                    <User className="h-4 w-4" /> Minha conta
                  </Link>
                )}
                {logado && isEditor && (
                  <Link
                    to="/admin/posts/novo"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm uppercase tracking-wide text-primary hover:bg-muted"
                  >
                    <PenSquare className="h-4 w-4" /> Incluir matéria
                  </Link>
                )}
                {logado && isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded px-3 py-2 text-sm uppercase tracking-wide hover:bg-muted"
                  >
                    <Shield className="h-4 w-4" /> Admin
                  </Link>
                )}
                {logado && (
                  <button
                    type="button"
                    onClick={sair}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm uppercase tracking-wide text-destructive hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                )}
                {logado && session?.user.email && (
                  <div className="mt-2 flex items-center gap-2 px-3 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{session.user.email}</span>
                  </div>
                )}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </>
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

function SecaoMenu({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-1 px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
      {children}
    </div>
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
