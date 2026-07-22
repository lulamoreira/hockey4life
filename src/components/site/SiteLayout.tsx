import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSiteConfig } from "@/lib/posts.functions";
import { Header, normalizeMenuCabecalho } from "./Header";
import { Footer } from "./Footer";
import { FundoArena, normalizeAparencia } from "./FundoArena";

type TemaMenu = { nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number };

export function SiteLayout({
  children,
  config: configOverride,
  temasMenu: temasMenuOverride,
}: {
  children: ReactNode;
  // Props opcionais mantidas para compat; se ausentes, o layout busca sozinho.
  config?: Record<string, any>;
  temasMenu?: TemaMenu[];
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["site-config"],
    queryFn: () => getSiteConfig(),
    staleTime: 120_000,
    enabled: !configOverride || !temasMenuOverride,
  });

  const config = configOverride ?? data?.config ?? {};
  const temasMenu = (temasMenuOverride ?? (data?.temasMenu as TemaMenu[] | undefined) ?? []) as TemaMenu[];
  const aparencia = normalizeAparencia(config?.aparencia);
  const menu = normalizeMenuCabecalho(config?.menu_cabecalho);
  const loading = !configOverride && !temasMenuOverride && isLoading && !data;

  return (
    <>
      <FundoArena aparencia={aparencia} />
      <div className="relative z-10 flex min-h-screen flex-col text-foreground">
        <Header temasMenu={temasMenu} menu={menu} loading={loading} />
        <main className="flex-1">{children}</main>
        <Footer config={config} />
      </div>
    </>
  );
}
