import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSiteConfig } from "@/lib/posts.functions";
import { Header } from "./Header";
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
  const { data } = useQuery({
    queryKey: ["site-config"],
    queryFn: () => getSiteConfig(),
    staleTime: 120_000,
    // Se o caller já forneceu, não precisa refetch imediato.
    enabled: !configOverride || !temasMenuOverride,
  });

  const config = configOverride ?? data?.config ?? {};
  const temasMenu = (temasMenuOverride ?? (data?.temasMenu as TemaMenu[] | undefined) ?? []) as TemaMenu[];
  const aparencia = normalizeAparencia(config?.aparencia);

  return (
    <>
      <FundoArena aparencia={aparencia} />
      <div className="relative z-10 flex min-h-screen flex-col text-foreground">
        <Header temasMenu={temasMenu} />
        <main className="flex-1">{children}</main>
        <Footer config={config} />
      </div>
    </>
  );
}
