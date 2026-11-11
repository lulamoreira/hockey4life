import { useEffect } from "react";

/**
 * Reativa embeds de Instagram, X/Twitter e TikTok vindos do WordPress.
 * A importação removeu as classes e os <script> dos widgets; aqui
 * reconhecemos os blockquotes pelo conteúdo, devolvemos a classe
 * esperada e carregamos o script oficial de cada rede (só se houver).
 */
const SCRIPTS = {
  instagram: "https://www.instagram.com/embed.js",
  twitter: "https://platform.twitter.com/widgets.js",
  tiktok: "https://www.tiktok.com/embed.js",
} as const;
type Rede = keyof typeof SCRIPTS;

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
    twttr?: { widgets?: { load: (el?: Element) => void } };
  }
}

function carregar(rede: Rede): void {
  if (rede === "instagram" && window.instgrm) return window.instgrm.Embeds.process();
  if (rede === "twitter" && window.twttr?.widgets) return window.twttr.widgets.load();
  const id = `h4l-embed-${rede}`;
  document.getElementById(id)?.remove(); // TikTok só reprocessa recarregando o script
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = SCRIPTS[rede];
  document.body.appendChild(s);
}

export function EmbedsSociais({ alvoId, chave }: { alvoId: string; chave: string }) {
  useEffect(() => {
    const raiz = document.getElementById(alvoId);
    if (!raiz) return;
    const achadas = new Set<Rede>();
    raiz.querySelectorAll("blockquote").forEach((bq) => {
      const html = bq.innerHTML;
      const cite = bq.getAttribute("cite") ?? "";
      if (bq.hasAttribute("data-instgrm-permalink") || /instagram\.com\/(p|reel|tv)\//.test(html)) {
        bq.classList.add("instagram-media");
        achadas.add("instagram");
      } else if (/tiktok\.com/.test(cite) || /tiktok\.com\/@[^/]+\/video\//.test(html)) {
        bq.classList.add("tiktok-embed");
        achadas.add("tiktok");
      } else if (/(twitter\.com|x\.com)\/[^/"]+\/status\/\d+/.test(html)) {
        bq.classList.add("twitter-tweet");
        bq.setAttribute("data-theme", document.documentElement.classList.contains("light") ? "light" : "dark");
        bq.setAttribute("data-lang", "pt");
        achadas.add("twitter");
      }
    });
    achadas.forEach(carregar);
  }, [alvoId, chave]);
  return null;
}
