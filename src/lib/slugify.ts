export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function tempoLeitura(html: string | null | undefined): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  const palavras = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(palavras / 200));
}
