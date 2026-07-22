import { useState } from "react";
import { parseYouTube } from "@/lib/youtube";

type Props = {
  url: string;
  title: string;
  className?: string;
};

/**
 * Fachada leve para vídeos do YouTube: mostra miniatura + botão play;
 * só carrega o iframe (youtube-nocookie) após clique.
 * Retorna null se a URL não for reconhecida.
 */
export function YouTubeFacade({ url, title, className }: Props) {
  const [play, setPlay] = useState(false);
  const parsed = parseYouTube(url);
  if (!parsed) return null;

  const embedSrc = play
    ? parsed.embedUrl + (parsed.embedUrl.includes("?") ? "&" : "?") + "autoplay=1"
    : null;

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black ${className ?? ""}`}>
      {embedSrc ? (
        <iframe
          src={embedSrc}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label={`Reproduzir vídeo: ${title}`}
          className="group absolute inset-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {parsed.thumbUrl && (
            <img
              src={parsed.thumbUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              loading="lazy"
            />
          )}
          <span className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
          <span className="relative flex h-16 w-24 items-center justify-center rounded-lg bg-black/80 shadow-lg transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
