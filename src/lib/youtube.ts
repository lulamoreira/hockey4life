// Utilitário para normalizar URLs do YouTube em endereço de incorporação.
// Aceita: watch?v=, youtu.be/, /shorts/, /embed/, /playlist?list=

export type YouTubeParsed = {
  embedUrl: string;
  thumbUrl: string;
  watchUrl: string;
  kind: "video" | "playlist";
  videoId?: string;
  listId?: string;
};

const NOCOOKIE = "https://www.youtube-nocookie.com";

function parseUrl(input: string): URL | null {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto);
  } catch {
    return null;
  }
}

function isYouTubeHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return (
    h === "youtube.com" ||
    h === "m.youtube.com" ||
    h === "youtu.be" ||
    h === "youtube-nocookie.com"
  );
}

export function parseYouTube(input: string): YouTubeParsed | null {
  const url = parseUrl(input);
  if (!url) return null;
  if (!isYouTubeHost(url.hostname)) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;
  const list = url.searchParams.get("list") ?? undefined;

  let videoId: string | undefined;

  if (host === "youtu.be") {
    videoId = path.replace(/^\//, "").split("/")[0] || undefined;
  } else if (path === "/watch") {
    videoId = url.searchParams.get("v") ?? undefined;
  } else if (path.startsWith("/shorts/")) {
    videoId = path.split("/")[2];
  } else if (path.startsWith("/embed/")) {
    const seg = path.split("/")[2];
    if (seg && seg !== "videoseries") videoId = seg;
  } else if (path === "/playlist") {
    if (list) {
      return {
        kind: "playlist",
        listId: list,
        embedUrl: `${NOCOOKIE}/embed/videoseries?list=${encodeURIComponent(list)}`,
        thumbUrl: "",
        watchUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}`,
      };
    }
    return null;
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

  const embedParams = new URLSearchParams();
  if (list) embedParams.set("list", list);
  const embedQs = embedParams.toString();
  const embedUrl = `${NOCOOKIE}/embed/${videoId}${embedQs ? `?${embedQs}` : ""}`;

  const watchParams = new URLSearchParams({ v: videoId });
  if (list) watchParams.set("list", list);
  const watchUrl = `https://www.youtube.com/watch?${watchParams.toString()}`;

  return {
    kind: "video",
    videoId,
    listId: list,
    embedUrl,
    thumbUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    watchUrl,
  };
}

export function toYouTubeEmbed(input: string): string | null {
  return parseYouTube(input)?.embedUrl ?? null;
}
