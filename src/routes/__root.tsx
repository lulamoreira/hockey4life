import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <h1 className="h4l-title text-7xl text-primary md:text-8xl">404</h1>
      <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A página que você procura não existe ou foi movida. Tente uma busca ou veja o que há de mais novo.
      </p>

      <form action="/busca" method="get" className="mt-6 flex w-full max-w-lg gap-2">
        <input name="q" placeholder="Buscar no Hockey4Life…" className="flex-1 rounded-md border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        <button className="rounded-md bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">Buscar</button>
      </form>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="/" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">Início</a>
        <a href="/arquivo" className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold uppercase tracking-wide hover:border-primary">Arquivo</a>
        <a href="/temas" className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold uppercase tracking-wide hover:border-primary">Temas</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="h4l-title text-3xl text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não conseguimos carregar essa página. Tente novamente ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hockey4Life — histórias de vida, superação e gentileza" },
      {
        name: "description",
        content:
          "Portal Hockey4Life: histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. Matérias, times e HFC.",
      },
      { name: "author", content: "Hockey4Life" },
      { property: "og:site_name", content: "Hockey4Life" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0d0d0f" },
      { property: "og:title", content: "Hockey4Life — histórias de vida, superação e gentileza" },
      { name: "twitter:title", content: "Hockey4Life — histórias de vida, superação e gentileza" },
      { property: "og:description", content: "Portal Hockey4Life: histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. Matérias, times e HFC." },
      { name: "twitter:description", content: "Portal Hockey4Life: histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. Matérias, times e HFC." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ef252f66-5922-4a80-8074-488fbf50210a" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ef252f66-5922-4a80-8074-488fbf50210a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
