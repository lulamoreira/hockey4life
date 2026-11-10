import type React from "react";
// Mapeia slug (temas.tipo='time') → tricode oficial da NHL.
// Logos servidos pelo CDN oficial: https://assets.nhle.com/logos/nhl/svg/{TRI}_light.svg
export const NHL_TRICODE_BY_SLUG: Record<string, string> = {
  "anaheim-ducks": "ANA",
  "arizona-coyotes": "ARI",
  "boston-bruins": "BOS",
  "buffalo-sabres": "BUF",
  "calgary-flames": "CGY",
  "carolina-hurricanes": "CAR",
  "chicago-blackhawks": "CHI",
  "colorado-avalanche": "COL",
  "columbus-blue-jackets": "CBJ",
  "dallas-stars": "DAL",
  "detroit-red-wings": "DET",
  "edmonton-oilers": "EDM",
  "florida-panthers": "FLA",
  "los-angeles-kings": "LAK",
  "minnesota-wild": "MIN",
  "montreal-canadiens": "MTL",
  "nashville-predators": "NSH",
  "new-jersey-devils": "NJD",
  "new-york-islanders": "NYI",
  "new-york-rangers": "NYR",
  "ottawa-senators": "OTT",
  "philadelphia-flyers": "PHI",
  "pittsburgh-penguins": "PIT",
  "san-jose-sharks": "SJS",
  "seattle-kraken": "SEA",
  "st-louis-blues": "STL",
  "tampa-bay-lightning": "TBL",
  "toronto-maple-leafs": "TOR",
  "utah-hockey-club": "UTA",
  "utah-mammoth": "UTA",
  "vancouver-canucks": "VAN",
  "vegas-golden-knights": "VGK",
  "washington-capitals": "WSH",
  "winnipeg-jets": "WPG",
};

export function nhlLogoUrl(slug: string): string | null {
  const tri = NHL_TRICODE_BY_SLUG[slug];
  if (!tri) return null;
  return `https://assets.nhle.com/logos/nhl/svg/${tri}_light.svg`;
}

// Área real do desenho dentro da tela 960x640 de cada logo oficial.
// Usado em object-view-box para o desenho preencher o card inteiro
// (sem as margens transparentes do arquivo SVG).
export const NHL_LOGO_VIEW_BOX: Record<string, string> = {
  ANA: "xywh(197px 68px 565px 503px)",
  ARI: "xywh(176px 0px 608px 640px)",
  BOS: "xywh(202px 42px 556px 556px)",
  BUF: "xywh(202px 42px 557px 557px)",
  CAR: "xywh(146px 119px 668px 402px)",
  CBJ: "xywh(181px 61px 598px 517px)",
  CGY: "xywh(207px 82px 545px 475px)",
  CHI: "xywh(197px 74px 565px 491px)",
  COL: "xywh(196px 86px 567px 468px)",
  DAL: "xywh(146px 46px 667px 548px)",
  DET: "xywh(142px 70px 676px 501px)",
  EDM: "xywh(198px 38px 563px 563px)",
  FLA: "xywh(241px 52px 478px 535px)",
  LAK: "xywh(120px 90px 721px 460px)",
  MIN: "xywh(146px 104px 669px 432px)",
  MTL: "xywh(152px 95px 657px 450px)",
  NJD: "xywh(221px 56px 517px 529px)",
  NSH: "xywh(170px 136px 620px 367px)",
  NYI: "xywh(216px 66px 527px 509px)",
  NYR: "xywh(232px 82px 496px 477px)",
  OTT: "xywh(150px 58px 659px 524px)",
  PHI: "xywh(197px 121px 566px 397px)",
  PIT: "xywh(202px 55px 557px 530px)",
  SEA: "xywh(268px 55px 423px 531px)",
  SJS: "xywh(161px 54px 638px 533px)",
  STL: "xywh(204px 103px 551px 434px)",
  TBL: "xywh(195px 55px 569px 531px)",
  TOR: "xywh(223px 34px 513px 573px)",
  UTA: "xywh(135px 66px 690px 507px)",
  VAN: "xywh(194px 48px 573px 543px)",
  VGK: "xywh(276px 44px 408px 552px)",
  WPG: "xywh(193px 33px 573px 573px)",
  WSH: "xywh(123px 92px 713px 455px)",
};

export function nhlLogoViewBox(slug: string): string | undefined {
  const tri = NHL_TRICODE_BY_SLUG[slug];
  return tri ? NHL_LOGO_VIEW_BOX[tri] : undefined;
}


/**
 * Estilo que faz o desenho do logo cobrir o card inteiro (como object-cover),
 * recortando as margens transparentes do SVG oficial (tela 960x640).
 *
 * Por que não object-view-box: no Safari/iOS, object-view-box + SVG +
 * object-cover deixa a imagem em branco. Aqui usamos só posicionamento
 * absoluto + unidades de contêiner (cqw/cqh), suportados no iOS 16+.
 * O elemento pai precisa ter `container-type: size` e posição relativa.
 */
export function nhlLogoCoverStyle(slug: string): React.CSSProperties | undefined {
  const vb = nhlLogoViewBox(slug);
  const m = vb?.match(/xywh\((\d+)px (\d+)px (\d+)px (\d+)px\)/);
  if (!m) return undefined;
  const [x, y, w, h] = m.slice(1).map(Number);
  if (!w || !h) return undefined;
  const cx = ((x + w / 2) / 960) * 100;
  const cy = ((y + h / 2) / 640) * 100;
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    // Largura da tela inteira do SVG necessária para o desenho cobrir largura E altura do card.
    width: `max(${((960 / w) * 100).toFixed(2)}cqw, ${((960 / h) * 100).toFixed(2)}cqh)`,
    maxWidth: "none",
    height: "auto",
    aspectRatio: "960 / 640",
    transform: `translate(-${cx.toFixed(2)}%, -${cy.toFixed(2)}%)`,
  };
}
