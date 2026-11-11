export interface InstagramArticle {
  titulo: string;
  resumo: string;
  conteudo: string;
  imagemCapa: string;
  creditoImagem: string;
  slug: string;
}

/** Browser-only: preserves paragraph boundaries and decodes HTML entities. */
export function textoParaLegenda(article: InstagramArticle): string {
  const doc = new DOMParser().parseFromString(article.conteudo, "text/html");
  doc.querySelectorAll("script, style, iframe").forEach((node) => node.remove());
  doc.querySelectorAll("p, div, br, h2, h3, li, blockquote").forEach((node) => node.append("\n"));
  return [article.titulo, article.resumo, doc.body.textContent ?? ""].join("\n\n").trim().slice(0, 40000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a foto da matéria. Confira a imagem de capa."));
    image.src = src;
  });
}

function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > width) { result.push(line); line = word; }
    else line = candidate;
  }
  if (line) result.push(line);
  return result;
}

/** Feed image, with an uncropped title and a centered, proportionate cover photo. */
export async function gerarImagemInstagram(article: InstagramArticle): Promise<Blob> {
  if (!article.imagemCapa) throw new Error("Adicione uma imagem de capa para gerar a postagem.");
  const image = await loadImage(article.imagemCapa);
  await document.fonts.load('64px "Anton"');
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu criar a imagem.");
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string) => tokens.getPropertyValue(name).trim();
  ctx.fillStyle = color("--social-background");
  ctx.fillRect(0, 0, 1080, 1350);
  const scale = Math.max(1080 / image.naturalWidth, 770 / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, 770); ctx.clip();
  ctx.drawImage(image, (1080 - width) / 2, (770 - height) / 2, width, height); ctx.restore();
  ctx.fillStyle = color("--brand-fill");
  ctx.fillRect(0, 770, 1080, 10);
  ctx.font = '32px "Anton", sans-serif'; ctx.textBaseline = "top";
  ctx.fillText("HOCKEY4LIFE · @hockey4lifebr", 60, 810);
  let size = 64;
  let titleLines: string[] = [];
  do {
    ctx.font = `${size}px "Anton", sans-serif`;
    titleLines = lines(ctx, article.titulo, 960);
    if (titleLines.length * size * 1.2 <= 330 && titleLines.every((line) => ctx.measureText(line).width <= 960)) break;
    size -= 2;
  } while (size >= 20);
  ctx.fillStyle = color("--social-foreground");
  titleLines.forEach((line, index) => ctx.fillText(line, 60, 875 + index * size * 1.2));
  ctx.font = '24px "Open Sans", sans-serif';
  if (article.creditoImagem.trim()) {
    let credit = `Foto: ${article.creditoImagem.trim()}`;
    while (ctx.measureText(credit).width > 960 && credit.length > 10) credit = credit.slice(0, -2);
    ctx.fillText(credit, 60, 1220);
  }
  ctx.fillStyle = color("--brand-fill");
  ctx.fillText("hockey4life.com.br", 60, 1280);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível salvar a imagem.")), "image/jpeg", 0.94,
  ));
}