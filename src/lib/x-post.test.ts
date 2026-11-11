import { describe, expect, it } from "bun:test";
import { prepararPostX, tamanhoPostX, urlCompositorX } from "./x-post";

describe("postagem para X", () => {
  const url = "https://hockey4life.com.br/uma-historia-de-superacao-no-hoquei";
  it("preserva o link da mesma matéria dentro de 280 caracteres", () => {
    const result = prepararPostX("Uma história de superação 🏒 ".repeat(30), url);
    expect(result.endsWith(url)).toBe(true);
    expect(tamanhoPostX(result)).toBeLessThanOrEqual(280);
    expect(result).toContain("…");
  });
  it("preserva uma legenda curta sem cortes e sem duplicar links", () => {
    expect(prepararPostX(`Gentileza no gelo! ${url}`, url)).toBe(`Gentileza no gelo!\n\n${url}`);
  });
  it("abre o compositor com exatamente o texto preparado", () => {
    const text = prepararPostX("Superação & gentileza #Hockey", url);
    expect(new URL(urlCompositorX(text)).searchParams.get("text")).toBe(text);
  });
});