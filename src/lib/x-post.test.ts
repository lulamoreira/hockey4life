import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepararPostX, tamanhoPostX, urlCompositorX } from "./x-post";

describe("postagem para X", () => {
  const url = "https://hockey4life.com.br/uma-historia-de-superacao-no-hoquei";
  it("preserva o link da mesma matéria dentro de 280 caracteres", () => {
    const result = prepararPostX("Uma história de superação 🏒 ".repeat(30), url);
    assert.equal(result.endsWith(url), true);
    assert.ok(tamanhoPostX(result) <= 280);
    assert.ok(result.includes("…"));
  });
  it("preserva uma legenda curta sem cortes e sem duplicar links", () => {
    assert.equal(prepararPostX(`Gentileza no gelo! ${url}`, url), `Gentileza no gelo!\n\n${url}`);
  });
  it("abre o compositor com exatamente o texto preparado", () => {
    const text = prepararPostX("Superação & gentileza #Hockey", url);
    assert.equal(new URL(urlCompositorX(text)).searchParams.get("text"), text);
  });
});