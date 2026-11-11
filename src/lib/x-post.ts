import twitterText from "twitter-text";

/** X weights links and emoji differently from JavaScript string lengths. */
export function tamanhoPostX(text: string): number {
  return twitterText.parseTweet(text).weightedLength;
}

export function prepararPostX(caption: string, url: string): string {
  const suffix = url ? `\n\n${url}` : "";
  let body = caption.replace(/https?:\/\/\S+/gi, "").trim();
  if (tamanhoPostX(body + suffix) <= 280) return body + suffix;
  const characters = Array.from(body);
  while (characters.length && tamanhoPostX(characters.join("").trimEnd() + "…" + suffix) > 280) characters.pop();
  body = characters.join("").trimEnd();
  return body + "…" + suffix;
}

export function urlCompositorX(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text })}`;
}