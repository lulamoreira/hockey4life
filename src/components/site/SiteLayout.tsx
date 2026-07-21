import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({
  children,
  config,
  temasMenu,
}: {
  children: ReactNode;
  config: Record<string, any>;
  temasMenu: Array<{ nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header temasMenu={temasMenu} />
      <main className="flex-1">{children}</main>
      <Footer config={config} />
    </div>
  );
}
