/**
 * Gera um font-size que cresce linearmente entre duas larguras de tela, sem
 * JavaScript: no celular vale o tamanho mínimo, no desktop o máximo.
 *
 * Ex.: fluidPx(40, 58) → 40px num celular de 390px, 58px numa tela de 1440px.
 */
export function fluidPx(min: number, max: number, fromVw = 390, toVw = 1440) {
  const safeMin = Math.max(1, Math.round(min));
  const safeMax = Math.max(safeMin, Math.round(max));
  if (safeMax === safeMin) return `${safeMin}px`;
  const span = Math.max(1, toVw - fromVw);
  const slope = (safeMax - safeMin) / span;
  return `min(${safeMax}px, max(${safeMin}px, calc(${safeMin}px + (100vw - ${fromVw}px) * ${slope.toFixed(5)})))`;
}
