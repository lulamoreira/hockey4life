import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FundoArena, normalizeAparencia } from "./FundoArena";

export function SiteLayout({
  children,
  config,
  temasMenu,
}: {
  children: ReactNode;
  config: Record<string, any>;
  temasMenu: Array<{ nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number }>;
}) {
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
