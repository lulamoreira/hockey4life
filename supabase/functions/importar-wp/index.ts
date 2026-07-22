// Edge function: importar-wp
// Importador WordPress -> Supabase, retomável, com lock, cursor por matéria e conferência.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const WP = "https://hockey4life.com.br/wp-json/wp/v2";
const BUCKET = "midia";
const TEMPO_MAX_MS = 50_000;
const HEARTBEAT_STALE_MS = 3 * 60_000;
const TAM_PADRAO = 25;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TAGS_IGNORAR = new Set(["hockey4life", "nhl", "hockey", "h4l"]);
const TIMES_NHL = new Set([
  "anaheim-ducks", "arizona-coyotes", "utah-hockey-club", "utah-mammoth",
  "boston-bruins", "buffalo-sabres", "calgary-flames", "carolina-hurricanes",
  "chicago-blackhawks", "colorado-avalanche", "columbus-blue-jackets",
  "dallas-stars", "detroit-red-wings", "edmonton-oilers", "florida-panthers",
  "los-angeles-kings", "minnesota-wild", "montreal-canadiens",
  "nashville-predators", "new-jersey-devils", "new-york-islanders",
  "new-york-rangers", "ottawa-senators", "philadelphia-flyers",
  "pittsburgh-penguins", "san-jose-sharks", "seattle-kraken",
  "st-louis-blues", "tampa-bay-lightning", "toronto-maple-leafs",
  "vancouver-canucks", "vegas-golden-knights", "washington-capitals",
  "winnipeg-jets",
]);

function decodeEntities(s: string): string {
  if (!s) return "";
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
    lsquo: "'", rsquo: "'", ldquo: "\u201C", rdquo: "\u201D",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    atilde: "ã", otilde: "õ", ccedil: "ç",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    Atilde: "Ã", Otilde: "Õ", Ccedil: "Ç",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => named[n] ?? m);
}
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, "")).trim();

function limparConteudo(html: string): string {
  let h = html;
  h = h.replace(/<!--\s*wp:[\s\S]*?-->/g, "").replace(/<!--\s*\/wp:[\s\S]*?-->/g, "");
  h = h.replace(/\s(srcset|sizes|width|height|class)="[^"]*"/gi, "");
  h = h.replace(/\s(srcset|sizes|width|height|class)='[^']*'/gi, "");
  return h;
}

function extractImgSrcs(html: string): string[] {
  const out: string[] = [];
  const re = /<img[^>]+src="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function extAno(url: string): { ano: string; nome: string } {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "uploads");
    const ano = idx >= 0 && /^\d{4}$/.test(parts[idx + 1]) ? parts[idx + 1] : String(new Date().getFullYear());
    const nome = decodeURIComponent(parts[parts.length - 1] || "img.jpg");
    return { ano, nome };
  } catch {
    return { ano: String(new Date().getFullYear()), nome: "img.jpg" };
  }
}

async function paralelo<T, R>(itens: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= itens.length) return;
      out[idx] = await fn(itens[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Cache de arquivos existentes por ano do bucket midia/wp/<ano>
type Cache = Map<string, Set<string>>;
async function listarAno(admin: any, ano: string, cache: Cache): Promise<Set<string>> {
  if (cache.has(ano)) return cache.get(ano)!;
  const set = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(`wp/${ano}`, { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const f of data) set.add(f.name);
    if (data.length < 1000) break;
    offset += data.length;
  }
  cache.set(ano, set);
  return set;
}

type ImgResult = { nova: string; bytes: number; baixada: boolean } | { erro: string };

async function baixarESubir(
  admin: any, publicBase: string, url: string, cache: Cache,
): Promise<ImgResult> {
  try {
    const { ano, nome } = extAno(url);
    const existentes = await listarAno(admin, ano, cache);
    const path = `wp/${ano}/${nome}`;
    const nova = `${publicBase}/${path}`;
    if (existentes.has(nome)) return { nova, bytes: 0, baixada: false };

    let tentativa = 0;
    let ultimoErro = "";
    while (tentativa < 2) {
      tentativa++;
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "H4L-Importer/2.0" } });
        clearTimeout(t);
        if (!r.ok) { ultimoErro = `HTTP ${r.status}`; continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        const ct = r.headers.get("content-type") ?? "image/jpeg";
        const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false });
        if (error && !`${error.message}`.toLowerCase().includes("exists")) {
          ultimoErro = `upload: ${error.message}`;
          continue;
        }
        existentes.add(nome);
        return { nova, bytes: buf.byteLength, baixada: true };
      } catch (e: any) {
        clearTimeout(t);
        ultimoErro = e?.name === "AbortError" ? "timeout 8s" : (e?.message ?? String(e));
      }
    }
    return { erro: `${ultimoErro} — ${url}` };
  } catch (e: any) {
    return { erro: `${url}: ${e?.message ?? e}` };
  }
}

async function importarTags(admin: any) {
  let page = 1;
  const mapa = new Map<number, { slug: string; nome: string; count: number }>();
  while (true) {
    const r = await fetch(`${WP}/tags?per_page=100&page=${page}&orderby=count&order=desc`);
    if (!r.ok) break;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const t of arr) {
      if (TAGS_IGNORAR.has(String(t.slug).toLowerCase())) continue;
      mapa.set(t.id, { slug: t.slug, nome: decodeEntities(t.name), count: t.count ?? 0 });
    }
    const total = parseInt(r.headers.get("x-wp-totalpages") ?? "1", 10);
    if (page >= total) break;
    page++;
  }
  const paraGravar = [...mapa.entries()].map(([wp_tag_id, v]) => ({
    wp_tag_id, slug: v.slug, nome: v.nome,
    tipo: TIMES_NHL.has(v.slug.toLowerCase()) ? "time" : "assunto",
  }));
  if (paraGravar.length) await admin.from("temas").upsert(paraGravar, { onConflict: "wp_tag_id" });
  return mapa.size;
}

// Coleta todos os wp_id da origem (paginado, campo id apenas).
async function coletarIdsOrigem(): Promise<number[]> {
  const ids: number[] = [];
  let page = 1;
  while (true) {
    const r = await fetch(`${WP}/posts?per_page=100&page=${page}&_fields=id&status=publish&orderby=date&order=asc`);
    if (!r.ok) break;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const p of arr) ids.push(Number(p.id));
    const total = parseInt(r.headers.get("x-wp-totalpages") ?? "1", 10);
    if (page >= total) break;
    page++;
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const t0 = Date.now();
  const jsonResp = (obj: any, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResp({ erro: "sem token" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResp({ erro: "não autenticado" }, 401);
    const uid = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return jsonResp({ erro: "acesso restrito" }, 403);

    const body = await req.json().catch(() => ({}));
    const acao: string = String(body.acao ?? "lote");
    const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

    // ---------- DESTRAVAR ----------
    if (acao === "destravar") {
      await admin.from("importacao_estado").upsert({
        id: 1, em_execucao: false, materia_atual: null, imagem_atual: null,
        batimento_em: new Date().toISOString(),
      });
      return jsonResp({ ok: true });
    }

    // ---------- CONFERIR ----------
    if (acao === "conferir") {
      const origem = await coletarIdsOrigem();
      const { data: dbRows } = await admin.from("posts").select("wp_id").not("wp_id", "is", null);
      const banco = new Set<number>((dbRows ?? []).map((r: any) => Number(r.wp_id)));
      const faltando = origem.filter((id) => !banco.has(id));
      return jsonResp({
        origem_total: origem.length,
        banco_total: banco.size,
        faltando,
        duracao_ms: Date.now() - t0,
      });
    }

    // ---------- Lock ----------
    const { data: estadoAtual } = await admin.from("importacao_estado").select("*").eq("id", 1).maybeSingle();
    if (estadoAtual?.em_execucao) {
      const hb = estadoAtual.batimento_em ? new Date(estadoAtual.batimento_em).getTime() : 0;
      if (Date.now() - hb < HEARTBEAT_STALE_MS) {
        return jsonResp({ bloqueado: true, batimento_em: estadoAtual.batimento_em });
      }
    }

    // Reserva o lock
    await admin.from("importacao_estado").upsert({
      id: 1, em_execucao: true, batimento_em: new Date().toISOString(),
      materia_atual: null, imagem_atual: null,
      ult_importados: 0, ult_atualizados: 0, ult_pulados: 0, ult_erros: 0, bytes_baixados: 0,
    });

    const heartbeat = async (extra: Record<string, any> = {}) => {
      await admin.from("importacao_estado").update({
        batimento_em: new Date().toISOString(), ...extra,
      }).eq("id", 1);
    };

    let importados = 0, atualizados = 0, pulados = 0, imagensSubidas = 0, bytes = 0;
    const erros: any[] = [];
    const log: { ts: string; nivel: string; msg: string }[] = [];
    const cacheAno: Cache = new Map();
    let parcial = false;
    let totalPaginas = 0;
    let paginaAtual = 0;
    let ultimoWpId: number | null = null;
    let idxFinal = 0;

    const registrar = (nivel: string, msg: string) => {
      log.unshift({ ts: new Date().toISOString(), nivel, msg });
    };

    // Mapa wp_tag -> tema uuid
    let temaByTagId = new Map<number, string>();
    const carregarMapaTemas = async () => {
      const { data } = await admin.from("temas").select("id, wp_tag_id").not("wp_tag_id", "is", null);
      temaByTagId = new Map<number, string>();
      for (const t of data ?? []) temaByTagId.set(t.wp_tag_id, t.id);
    };

    // ------- processador de um post individual -------
    async function processarPost(p: any): Promise<"IMPORTADA" | "ATUALIZADA" | "PULADA" | "ERRO"> {
      const wp_id: number = p.id;
      const slug: string = p.slug;
      const titulo = decodeEntities(String(p.title?.rendered ?? ""));
      try {
        await heartbeat({ materia_atual: titulo.slice(0, 200), imagem_atual: null });

        const { data: existente } = await admin
          .from("posts").select("id, atualizado_em").eq("wp_id", wp_id).maybeSingle();
        const { data: itemLog } = await admin
          .from("importacao_itens").select("importado_em, status").eq("wp_id", wp_id).maybeSingle();

        // trava contra sobrescrita de edição manual
        if (existente && itemLog && new Date(existente.atualizado_em) > new Date(itemLog.importado_em)) {
          return "PULADA";
        }

        const modifiedRaw = p.modified_gmt ? p.modified_gmt + "Z" : (p.modified ?? null);
        const modifiedAt = modifiedRaw ? new Date(modifiedRaw) : null;
        const jaOk = existente && itemLog && itemLog.status === "ok";
        const forcar: boolean = Boolean(body.forcar);
        const modoIds: boolean = acao === "importar_ids" || Array.isArray(body.reprocessar);

        if (!forcar && !modoIds && jaOk) {
          if (!modifiedAt || modifiedAt <= new Date(itemLog!.importado_em)) {
            return "PULADA";
          }
        }

        let conteudo = limparConteudo(String(p.content?.rendered ?? ""));
        const srcs = extractImgSrcs(conteudo).filter((s) => s.includes("/wp-content/"));
        const resultados = await paralelo(srcs, 4, async (src) => {
          await heartbeat({ imagem_atual: src.slice(0, 200) });
          return baixarESubir(admin, publicBase, src, cacheAno);
        });
        srcs.forEach((src, idx) => {
          const r = resultados[idx];
          if ("nova" in r) {
            conteudo = conteudo.split(src).join(r.nova);
            if (r.baixada) { imagensSubidas++; bytes += r.bytes; }
          } else {
            erros.push({ wp_id, imagem: src, erro: r.erro });
          }
        });

        let imagem_capa: string | null = null;
        const featured = p?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
        if (featured) {
          await heartbeat({ imagem_atual: featured.slice(0, 200) });
          const r = await baixarESubir(admin, publicBase, featured, cacheAno);
          if ("nova" in r) {
            imagem_capa = r.nova;
            if (r.baixada) { imagensSubidas++; bytes += r.bytes; }
          } else {
            erros.push({ wp_id, imagem: featured, erro: r.erro });
          }
        }

        const registro = {
          wp_id, titulo, slug,
          resumo: stripTags(String(p.excerpt?.rendered ?? "")).slice(0, 500),
          conteudo, imagem_capa, autor_id: uid,
          status: "publicado" as const,
          publicado_em: p.date_gmt ? new Date(p.date_gmt + "Z").toISOString() : new Date(p.date).toISOString(),
        };

        const { data: up, error: upErr } = await admin
          .from("posts").upsert(registro, { onConflict: "wp_id" }).select("id").single();
        if (upErr) throw upErr;

        const tagIds: number[] = Array.isArray(p.tags) ? p.tags : [];
        const temaIds = tagIds.map((id) => temaByTagId.get(id)).filter(Boolean) as string[];
        if (temaIds.length) {
          await admin.from("post_temas").delete().eq("post_id", up.id);
          await admin.from("post_temas").insert(temaIds.map((tema_id) => ({ post_id: up.id, tema_id })));
        }
        await admin.from("importacao_itens").upsert(
          { wp_id, slug, status: "ok", erro: null, importado_em: new Date().toISOString() },
          { onConflict: "wp_id" },
        );
        return existente ? "ATUALIZADA" : "IMPORTADA";
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        erros.push({ wp_id, slug, erro: msg });
        await admin.from("importacao_itens").upsert(
          { wp_id, slug, status: "erro", erro: msg, importado_em: new Date().toISOString() },
          { onConflict: "wp_id" },
        );
        return "ERRO";
      }
    }

    try {
      // ---------- IMPORTAR IDS EXPLÍCITOS ----------
      if (acao === "importar_ids" || Array.isArray(body.reprocessar)) {
        const ids: number[] = (body.ids ?? body.reprocessar ?? []).map(Number).filter(Boolean);
        if (!ids.length) {
          return jsonResp({ erro: "sem ids", importados, atualizados, pulados, imagens_subidas: imagensSubidas, erros, log });
        }
        await carregarMapaTemas();
        // WP aceita include= com múltiplos ids, per_page até 100
        const CHUNK = 25;
        for (let i = 0; i < ids.length; i += CHUNK) {
          if (Date.now() - t0 > TEMPO_MAX_MS) { parcial = true; break; }
          const parte = ids.slice(i, i + CHUNK);
          const r = await fetch(`${WP}/posts?include=${parte.join(",")}&per_page=${parte.length}&_embed=1`);
          if (!r.ok) { registrar("erro", `WP HTTP ${r.status}`); continue; }
          const posts = await r.json();
          const results = await paralelo(posts, 4, async (p: any) => {
            const status = await processarPost(p);
            registrar(status.toLowerCase(), `#${p.id} ${decodeEntities(p.title?.rendered ?? "")}`);
            return status;
          });
          for (const s of results) {
            if (s === "IMPORTADA") importados++;
            else if (s === "ATUALIZADA") atualizados++;
            else if (s === "PULADA") pulados++;
          }
        }
        await admin.from("importacao_estado").update({
          em_execucao: false, materia_atual: null, imagem_atual: null,
          ult_importados: importados, ult_atualizados: atualizados,
          ult_pulados: pulados, ult_erros: erros.length, bytes_baixados: bytes,
          batimento_em: new Date().toISOString(),
        }).eq("id", 1);
        return jsonResp({
          acao, importados, atualizados, pulados, imagens_subidas: imagensSubidas,
          bytes_baixados: bytes, erros, log, parcial, duracao_ms: Date.now() - t0,
        });
      }

      // ---------- LOTE SEQUENCIAL ----------
      // cursor
      paginaAtual = Math.max(1, estadoAtual?.ultima_pagina ?? 0);
      let idxInicio = estadoAtual?.indice_pagina ?? 0;
      const paginaCompleta = idxInicio === 0;
      // Se estado indica página X completa (idx=0 e wp_id preenchido), avança
      if (paginaCompleta && (estadoAtual?.ultima_pagina ?? 0) > 0) {
        paginaAtual = (estadoAtual?.ultima_pagina ?? 0) + 1;
        idxInicio = 0;
      }
      if (paginaAtual < 1) paginaAtual = 1;

      // Importa tags só na primeira página
      let tagsImportadas = 0;
      if (paginaAtual === 1 && idxInicio === 0) {
        tagsImportadas = await importarTags(admin);
      }
      await carregarMapaTemas();

      const tamanho = Math.min(50, Math.max(1, Number(body.tamanho ?? TAM_PADRAO)));
      const url = `${WP}/posts?page=${paginaAtual}&per_page=${tamanho}&_embed=1&orderby=date&order=asc&status=publish`;
      const r = await fetch(url);
      if (!r.ok) {
        const txt = await r.text();
        await admin.from("importacao_estado").update({ em_execucao: false }).eq("id", 1);
        return jsonResp({ erro: `WP ${r.status}: ${txt.slice(0, 200)}` }, 502);
      }
      totalPaginas = parseInt(r.headers.get("x-wp-totalpages") ?? "0", 10);
      const posts = await r.json();
      registrar("info", `Página ${paginaAtual}/${totalPaginas} recebida (${posts.length} posts), iniciando no índice ${idxInicio}`);

      // Processa em paralelo com concorrência 4, respeitando tempo limite
      let cursorIdx = idxInicio;
      const fila = posts.slice(idxInicio).map((p: any, i: number) => ({ p, idx: idxInicio + i }));

      let pararLote = false;
      await paralelo(fila, 4, async (item: any) => {
        if (pararLote) return;
        if (Date.now() - t0 > TEMPO_MAX_MS) { pararLote = true; parcial = true; return; }
        const status = await processarPost(item.p);
        if (status === "IMPORTADA") importados++;
        else if (status === "ATUALIZADA") atualizados++;
        else if (status === "PULADA") pulados++;
        // registra progresso
        cursorIdx = Math.max(cursorIdx, item.idx + 1);
        ultimoWpId = item.p.id;
        idxFinal = cursorIdx;
        registrar(status.toLowerCase(), `#${item.p.id} ${decodeEntities(item.p.title?.rendered ?? "")}`);
        // atualiza cursor no banco a cada matéria concluída
        await heartbeat({
          indice_pagina: cursorIdx, ultimo_wp_id: ultimoWpId,
          ult_importados: importados, ult_atualizados: atualizados,
          ult_pulados: pulados, ult_erros: erros.length, bytes_baixados: bytes,
        });
      });

      // Página processada por completo?
      const paginaTerminou = !parcial && cursorIdx >= posts.length;
      const concluido = paginaTerminou && totalPaginas > 0 && paginaAtual >= totalPaginas;

      await admin.from("importacao_estado").update({
        ultima_pagina: paginaAtual,
        indice_pagina: paginaTerminou ? 0 : cursorIdx,
        ultimo_wp_id: ultimoWpId,
        total_paginas: totalPaginas,
        em_execucao: false,
        concluido,
        materia_atual: null, imagem_atual: null,
        ult_importados: importados, ult_atualizados: atualizados,
        ult_pulados: pulados, ult_erros: erros.length, bytes_baixados: bytes,
        batimento_em: new Date().toISOString(),
      }).eq("id", 1);

      const resp = {
        acao: "lote",
        pagina: paginaAtual,
        total_paginas: totalPaginas,
        indice_pagina_final: paginaTerminou ? 0 : cursorIdx,
        pagina_completa: paginaTerminou,
        concluido,
        parcial,
        importados, atualizados, pulados,
        imagens_subidas: imagensSubidas,
        bytes_baixados: bytes,
        tags_importadas: tagsImportadas,
        erros,
        log,
        duracao_ms: Date.now() - t0,
      };
      console.log("[importar-wp]", JSON.stringify({ ...resp, log: undefined, erros: erros.length }));
      return jsonResp(resp);
    } finally {
      // segurança: garante liberação do lock se algo escapar
      const still = await admin.from("importacao_estado").select("em_execucao").eq("id", 1).maybeSingle();
      if (still.data?.em_execucao) {
        await admin.from("importacao_estado").update({
          em_execucao: false, batimento_em: new Date().toISOString(),
        }).eq("id", 1);
      }
    }
  } catch (e: any) {
    console.error("[importar-wp] fatal", e?.message ?? e);
    return new Response(JSON.stringify({ erro: e?.message ?? String(e) }), {
      status: 500, headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
