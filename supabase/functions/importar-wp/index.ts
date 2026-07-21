// Edge function: importar-wp
// Importa lote a lote os posts, imagens e tags de https://hockey4life.com.br/wp-json/wp/v2
// Roda no servidor porque /wp-content/uploads não envia CORS.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const WP = "https://hockey4life.com.br/wp-json/wp/v2";
const BUCKET = "midia";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tags "guarda-chuva" a ignorar (aparecem em quase todos os posts)
const TAGS_IGNORAR = new Set(["hockey4life", "nhl", "hockey", "h4l"]);

// Slugs de tags que devem virar tema tipo 'time'
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
    "amp": "&", "lt": "<", "gt": ">", "quot": '"', "apos": "'", "nbsp": " ",
    "hellip": "…", "mdash": "—", "ndash": "–", "laquo": "«", "raquo": "»",
    "lsquo": "'", "rsquo": "'", "ldquo": "\u201C", "rdquo": "\u201D",
    "aacute": "á", "eacute": "é", "iacute": "í", "oacute": "ó", "uacute": "ú",
    "atilde": "ã", "otilde": "õ", "ccedil": "ç",
    "Aacute": "Á", "Eacute": "É", "Iacute": "Í", "Oacute": "Ó", "Uacute": "Ú",
    "Atilde": "Ã", "Otilde": "Õ", "Ccedil": "Ç",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => named[n] ?? m);
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

function limparConteudo(html: string): string {
  let h = html;
  // remove comentários de bloco WP
  h = h.replace(/<!--\s*wp:[\s\S]*?-->/g, "").replace(/<!--\s*\/wp:[\s\S]*?-->/g, "");
  // remove atributos ruidosos em qualquer tag
  h = h.replace(/\s(srcset|sizes|width|height|class)="[^"]*"/gi, "");
  h = h.replace(/\s(srcset|sizes|width|height|class)='[^']*'/gi, "");
  // remove atributos style inline em img/figure
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
    // padrão WP: /wp-content/uploads/2024/03/arquivo.jpg
    const idx = parts.findIndex((p) => p === "uploads");
    const ano = (idx >= 0 && /^\d{4}$/.test(parts[idx + 1])) ? parts[idx + 1] : String(new Date().getFullYear());
    const nome = decodeURIComponent(parts[parts.length - 1] || "img.jpg");
    return { ano, nome };
  } catch {
    return { ano: String(new Date().getFullYear()), nome: "img.jpg" };
  }
}

async function baixarESubir(
  admin: any, publicBase: string, url: string,
): Promise<{ nova: string } | { erro: string }> {
  try {
    const { ano, nome } = extAno(url);
    const path = `wp/${ano}/${nome}`;
    // já existe?
    const nova = `${publicBase}/${path}`;
    const head = await fetch(nova, { method: "HEAD" });
    if (head.ok) return { nova };

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "H4L-Importer/1.0" } });
    clearTimeout(t);
    if (!r.ok) return { erro: `HTTP ${r.status} baixando ${url}` };
    const buf = new Uint8Array(await r.arrayBuffer());
    const ct = r.headers.get("content-type") ?? "image/jpeg";
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: ct, upsert: false,
    });
    if (error && !`${error.message}`.toLowerCase().includes("exists")) {
      return { erro: `upload ${path}: ${error.message}` };
    }
    return { nova };
  } catch (e: any) {
    return { erro: `${url}: ${e?.message ?? e}` };
  }
}

async function importarTags(admin: any) {
  let page = 1;
  const paraGravar: any[] = [];
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
  for (const [wp_tag_id, v] of mapa.entries()) {
    const tipo = TIMES_NHL.has(v.slug.toLowerCase()) ? "time" : "assunto";
    paraGravar.push({ wp_tag_id, slug: v.slug, nome: v.nome, tipo });
  }
  if (paraGravar.length) {
    await admin.from("temas").upsert(paraGravar, { onConflict: "wp_tag_id" });
  }
  // marca destaque_menu nos 8 assuntos mais frequentes
  const topAssuntos = [...mapa.entries()]
    .filter(([, v]) => !TIMES_NHL.has(v.slug.toLowerCase()))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([id]) => id);
  if (topAssuntos.length) {
    await admin.from("temas").update({ destaque_menu: true }).in("wp_tag_id", topAssuntos);
  }
  return mapa.size;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const t0 = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ erro: "sem token" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });

    // valida caller
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ erro: "não autenticado" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });
    const uid = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ erro: "acesso restrito" }), { status: 403, headers: { ...CORS, "content-type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const pagina = Math.max(1, Number(body.pagina ?? 1));
    const tamanho = Math.min(15, Math.max(1, Number(body.tamanho ?? 10)));
    const forcar: boolean = Boolean(body.forcar);
    const somenteErros: number[] | undefined = Array.isArray(body.reprocessar) ? body.reprocessar.map(Number) : undefined;

    // publicBase do bucket
    const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

    // Importa tags só no primeiro lote (pagina===1 e sem reprocessar)
    let tagsImportadas = 0;
    if (!somenteErros && pagina === 1) {
      tagsImportadas = await importarTags(admin);
    }

    // Busca posts
    let posts: any[] = [];
    let totalPaginas = 0;
    if (somenteErros && somenteErros.length) {
      const chunks = somenteErros.slice(0, tamanho);
      const r = await fetch(`${WP}/posts?include=${chunks.join(",")}&per_page=${chunks.length}&_embed=1`);
      posts = await r.json();
      totalPaginas = 1;
    } else {
      const url = `${WP}/posts?page=${pagina}&per_page=${tamanho}&_embed=1&orderby=date&order=asc&status=publish`;
      const r = await fetch(url);
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ erro: `WP ${r.status}: ${txt.slice(0, 200)}` }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
      }
      totalPaginas = parseInt(r.headers.get("x-wp-totalpages") ?? "0", 10);
      posts = await r.json();
    }

    // Mapa wp_tag_id -> tema uuid
    const { data: temas } = await admin.from("temas").select("id, wp_tag_id").not("wp_tag_id", "is", null);
    const temaByTagId = new Map<number, string>();
    for (const t of temas ?? []) temaByTagId.set(t.wp_tag_id, t.id);

    let importados = 0;
    let atualizados = 0;
    let pulados = 0;
    let imagensSubidas = 0;
    const erros: any[] = [];

    for (const p of posts) {
      const wp_id: number = p.id;
      const slug: string = p.slug;
      try {
        // idempotência: se atualizado_em > importado_em, não sobrescreve
        const { data: existente } = await admin
          .from("posts").select("id, atualizado_em").eq("wp_id", wp_id).maybeSingle();
        const { data: itemLog } = await admin
          .from("importacao_itens").select("importado_em").eq("wp_id", wp_id).maybeSingle();
        if (existente && itemLog && new Date(existente.atualizado_em) > new Date(itemLog.importado_em)) {
          pulados++;
          continue;
        }

        let conteudo = limparConteudo(String(p.content?.rendered ?? ""));
        const srcs = extractImgSrcs(conteudo);
        for (const src of srcs) {
          if (!src.includes("/wp-content/")) continue;
          const r = await baixarESubir(admin, publicBase, src);
          if ("nova" in r) {
            conteudo = conteudo.split(src).join(r.nova);
            imagensSubidas++;
          } else {
            erros.push({ wp_id, imagem: src, erro: r.erro });
          }
        }

        // capa
        let imagem_capa: string | null = null;
        const featured = p?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
        if (featured) {
          const r = await baixarESubir(admin, publicBase, featured);
          if ("nova" in r) { imagem_capa = r.nova; imagensSubidas++; }
          else erros.push({ wp_id, imagem: featured, erro: r.erro });
        }

        const registro = {
          wp_id,
          titulo: decodeEntities(String(p.title?.rendered ?? "")),
          slug,
          resumo: stripTags(String(p.excerpt?.rendered ?? "")).slice(0, 500),
          conteudo,
          imagem_capa,
          autor_id: uid,
          status: "publicado" as const,
          publicado_em: p.date_gmt ? new Date(p.date_gmt + "Z").toISOString() : new Date(p.date).toISOString(),
        };

        const { data: up, error: upErr } = await admin
          .from("posts").upsert(registro, { onConflict: "wp_id" }).select("id").single();
        if (upErr) throw upErr;

        // vincula temas
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
        importados++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        erros.push({ wp_id, slug, erro: msg });
        await admin.from("importacao_itens").upsert(
          { wp_id, slug, status: "erro", erro: msg, importado_em: new Date().toISOString() },
          { onConflict: "wp_id" },
        );
      }
    }

    // Atualiza estado (só para importação sequencial, não para reprocessar)
    if (!somenteErros) {
      const { data: est } = await admin.from("importacao_estado").select("total_importados").eq("id", 1).single();
      const totalImportados = (est?.total_importados ?? 0) + importados;
      await admin.from("importacao_estado").upsert({
        id: 1,
        ultima_pagina: pagina,
        total_paginas: totalPaginas,
        total_importados: totalImportados,
        concluido: totalPaginas > 0 && pagina >= totalPaginas,
        atualizado_em: new Date().toISOString(),
      });
    }

    const resp = {
      pagina, total_paginas: totalPaginas, importados, pulados,
      imagens_subidas: imagensSubidas, tags_importadas: tagsImportadas,
      erros, duracao_ms: Date.now() - t0,
    };
    console.log("[importar-wp]", JSON.stringify(resp));
    return new Response(JSON.stringify(resp), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e: any) {
    console.error("[importar-wp] fatal", e?.message ?? e);
    return new Response(JSON.stringify({ erro: e?.message ?? String(e) }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  }
});
