import { useState } from "react";
import { Facebook, Link as LinkIcon, MessageCircle, Send, Share2 } from "lucide-react";

export function ShareButtons({ url, titulo }: { url: string; titulo: string }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);

  const items = [
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${encoded}`, icon: MessageCircle },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${encoded}`, icon: Share2 },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, icon: Facebook },
    { label: "Telegram", href: `https://t.me/share/url?url=${encoded}&text=${t}`, icon: Send },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Compartilhar:</span>
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          <it.icon className="h-3.5 w-3.5" />
          {it.label}
        </a>
      ))}
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
