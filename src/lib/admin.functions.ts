import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Verifica se o usuário atual é admin ou editor
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r) => r.role);
    return {
      userId: context.userId,
      isAdmin: roles.includes("admin"),
      isEditor: roles.includes("editor"),
      isStaff: roles.includes("admin") || roles.includes("editor"),
      roles,
    };
  });

// ============ POSTS (admin) ============
const postInput = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  chapeu: z.string().max(30).optional().nullable(),
  resumo: z.string().max(1000).optional().nullable(),
  conteudo: z.string().optional().nullable(),
  imagem_capa: z.string().url().optional().nullable().or(z.literal("")),
  credito_imagem: z.string().max(200).optional().nullable(),
  status: z.enum(["rascunho", "publicado"]),
  destaque: z.boolean().default(false),
  nao_perca: z.boolean().default(false),
  publicado_em: z.string().nullable().optional(),
  autor_id: z.string().uuid().nullable().optional(),
  temaIds: z.array(z.string().uuid()).default([]),
});

export const listAdminPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      status: z.enum(["todos", "rascunho", "publicado"]).default("todos"),
      q: z.string().default(""),
      page: z.number().int().min(1).default(1),
      ordem: z.enum(["desc", "asc"]).default("desc"),
      sem_chapeu: z.boolean().default(false),
    }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    const perPage = 25;
    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const asc = data.ordem === "asc";
    let q = context.supabase
      .from("posts")
      .select("id,titulo,slug,chapeu,status,destaque,nao_perca,publicado_em,atualizado_em", { count: "exact" })
      .order("publicado_em", { ascending: asc, nullsFirst: asc })
      .order("id", { ascending: asc })
      .range(from, to);
    if (data.status !== "todos") q = q.eq("status", data.status);
    if (data.q) q = q.ilike("titulo", `%${data.q}%`);
    if (data.sem_chapeu) q = q.or("chapeu.is.null,chapeu.eq.");
    const { data: items, count, error } = await q;
    if (error) throw error;
    return {
      items: items ?? [],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    };
  });

export const getAdminPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { data: post, error } = await context.supabase
      .from("posts")
      .select("id,titulo,slug,chapeu,resumo,conteudo,imagem_capa,credito_imagem,status,destaque,nao_perca,publicado_em,atualizado_em,criado_em,autor_id,wp_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!post) return null;
    const { data: rels } = await context.supabase
      .from("post_temas")
      .select("tema_id")
      .eq("post_id", data.id);
    return { post, temaIds: (rels ?? []).map((r) => r.tema_id) };
  });

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => postInput.parse(v))
  .handler(async ({ context, data }) => {
    const payload: any = {
      titulo: data.titulo,
      slug: data.slug,
      resumo: data.resumo || null,
      conteudo: data.conteudo || null,
      imagem_capa: data.imagem_capa || null,
      credito_imagem: data.credito_imagem || null,
      status: data.status,
      destaque: data.destaque,
      nao_perca: data.nao_perca,
      publicado_em: data.publicado_em || (data.status === "publicado" ? new Date().toISOString() : null),
      autor_id: data.autor_id ?? null,
    };
    let postId = data.id;
    if (postId) {
      const { error } = await context.supabase.from("posts").update(payload).eq("id", postId);
      if (error) throw error;
    } else {
      const { data: created, error } = await context.supabase
        .from("posts").insert(payload).select("id").single();
      if (error) throw error;
      postId = created.id;
    }
    // Só uma matéria pode estar fixada. Solta as demais.
    if (data.destaque) {
      await context.supabase.from("posts").update({ destaque: false })
        .eq("destaque", true).neq("id", postId!);
    }
    // Reset temas
    await context.supabase.from("post_temas").delete().eq("post_id", postId!);
    if (data.temaIds.length > 0) {
      const rows = data.temaIds.map((tid) => ({ post_id: postId!, tema_id: tid }));
      const { error } = await context.supabase.from("post_temas").insert(rows);
      if (error) throw error;
    }
    return { id: postId };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("posts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Retorna a matéria fixada atualmente (destaque = true), se houver.
export const getPostFixado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("posts")
      .select("id,titulo,slug,status,publicado_em")
      .eq("destaque", true)
      .order("publicado_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

// Solta a matéria fixada (destaque = false).
export const desafixarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("posts").update({ destaque: false }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ TEMAS ============
// Lista simples (compat): usada em pickers/editor de posts.
export const listTemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const all: any[] = [];
    let from = 0;
    const size = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await context.supabase
        .from("temas")
        .select("*")
        .order("tipo").order("ordem").order("nome").order("id")
        .range(from, from + size - 1);
      if (error) throw error;
      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < size) break;
      from += size;
    }
    return all;
  });

// Lista paginada com filtros + contagem por tema (para o admin).
export const listTemasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      q: z.string().default(""),
      tipo: z.enum(["todos", "time", "assunto"]).default("todos"),
      menu: z.enum(["todos", "sim", "nao"]).default("todos"),
      ordemPor: z.enum(["nome", "ordem", "total", "tipo"]).default("nome"),
      ordem: z.enum(["asc", "desc"]).default("asc"),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(10).max(200).default(50),
    }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    const from = (data.page - 1) * data.perPage;
    const to = from + data.perPage - 1;

    // Ordenação por total (contagem) exige cálculo em memória do conjunto filtrado.
    if (data.ordemPor === "total") {
      let q = context.supabase.from("temas").select("id,nome,slug,tipo,destaque_menu,ordem");
      if (data.tipo !== "todos") q = q.eq("tipo", data.tipo);
      if (data.menu === "sim") q = q.eq("destaque_menu", true);
      if (data.menu === "nao") q = q.eq("destaque_menu", false);
      if (data.q.trim()) q = q.ilike("nome", `%${data.q.trim()}%`);
      const { data: rows, error } = await q.order("nome", { ascending: true }).range(0, 9999);
      if (error) throw error;
      const counts = await contarPorTemas(context.supabase, (rows ?? []).map((r: any) => r.id));
      const enriched = (rows ?? []).map((r: any) => ({ ...r, total: counts.get(r.id) ?? 0 }));
      enriched.sort((a: any, b: any) => (data.ordem === "asc" ? a.total - b.total : b.total - a.total));
      const slice = enriched.slice(from, to + 1);
      const totalGeral = await context.supabase.from("temas").select("*", { count: "exact", head: true });
      const totalNoMenu = await context.supabase.from("temas").select("*", { count: "exact", head: true }).eq("destaque_menu", true);
      return {
        items: slice,
        total: enriched.length,
        totalPages: Math.max(1, Math.ceil(enriched.length / data.perPage)),
        page: data.page,
        perPage: data.perPage,
        totalGeral: totalGeral.count ?? 0,
        totalNoMenu: totalNoMenu.count ?? 0,
      };
    }

    let q = context.supabase
      .from("temas")
      .select("id,nome,slug,tipo,destaque_menu,ordem", { count: "exact" });
    if (data.tipo !== "todos") q = q.eq("tipo", data.tipo);
    if (data.menu === "sim") q = q.eq("destaque_menu", true);
    if (data.menu === "nao") q = q.eq("destaque_menu", false);
    if (data.q.trim()) q = q.ilike("nome", `%${data.q.trim()}%`);

    const asc = data.ordem === "asc";
    if (data.ordemPor === "nome") q = q.order("nome", { ascending: asc }).order("id", { ascending: asc });
    else if (data.ordemPor === "ordem") q = q.order("ordem", { ascending: asc }).order("nome", { ascending: true });
    else if (data.ordemPor === "tipo") q = q.order("tipo", { ascending: asc }).order("nome", { ascending: true });

    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw error;
    const counts = await contarPorTemas(context.supabase, (rows ?? []).map((r: any) => r.id));
    const items = (rows ?? []).map((r: any) => ({ ...r, total: counts.get(r.id) ?? 0 }));

    const totalGeral = await context.supabase.from("temas").select("*", { count: "exact", head: true });
    const totalNoMenu = await context.supabase.from("temas").select("*", { count: "exact", head: true }).eq("destaque_menu", true);

    return {
      items,
      total: count ?? items.length,
      totalPages: Math.max(1, Math.ceil((count ?? items.length) / data.perPage)),
      page: data.page,
      perPage: data.perPage,
      totalGeral: totalGeral.count ?? 0,
      totalNoMenu: totalNoMenu.count ?? 0,
    };
  });

async function contarPorTemas(sb: any, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await sb.from("post_temas").select("tema_id").in("tema_id", chunk).range(0, 99999);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(row.tema_id, (map.get(row.tema_id) ?? 0) + 1);
    }
    for (const id of chunk) if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

const temaInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  tipo: z.enum(["time", "assunto"]),
  destaque_menu: z.boolean().default(false),
  ordem: z.number().int().default(0),
});

export const saveTema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => temaInput.parse(v))
  .handler(async ({ context, data }) => {
    if (data.id) {
      const { error } = await context.supabase.from("temas").update({
        nome: data.nome, slug: data.slug, tipo: data.tipo,
        destaque_menu: data.destaque_menu, ordem: data.ordem,
      }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("temas").insert({
        nome: data.nome, slug: data.slug, tipo: data.tipo,
        destaque_menu: data.destaque_menu, ordem: data.ordem,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

// Alterna a flag "aparece no menu" com um clique.
export const toggleTemaMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), valor: z.boolean() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("temas").update({ destaque_menu: data.valor }).eq("id", data.id);
    if (error) throw error;
    const { count } = await context.supabase.from("temas").select("*", { count: "exact", head: true }).eq("destaque_menu", true);
    return { ok: true, totalNoMenu: count ?? 0 };
  });

// Atualiza campos editáveis inline (nome, tipo, ordem). Slug é preservado.
export const updateTemaCampos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid(),
      nome: z.string().min(1).max(120).optional(),
      tipo: z.enum(["time", "assunto"]).optional(),
      ordem: z.number().int().optional(),
    }).parse(v),
  )
  .handler(async ({ context, data }) => {
    const patch: any = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.tipo !== undefined) patch.tipo = data.tipo;
    if (data.ordem !== undefined) patch.ordem = data.ordem;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("temas").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Exclusão segura: se o tema tiver matérias, exige forcar=true (só desvincula).
export const deleteTema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), forcar: z.boolean().default(false) }).parse(v))
  .handler(async ({ context, data }) => {
    const { count, error: ce } = await context.supabase
      .from("post_temas").select("*", { count: "exact", head: true }).eq("tema_id", data.id);
    if (ce) throw ce;
    const usados = count ?? 0;
    if (usados > 0 && !data.forcar) {
      return { ok: false as const, motivo: "em_uso" as const, materias: usados };
    }
    const { error } = await context.supabase.from("temas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const, materiasDesvinculadas: usados };
  });

// Mescla temas via RPC (SECURITY DEFINER). Retorna prévia se dryRun=true.
export const mesclarTemas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      principal_id: z.string().uuid(),
      secundarios_ids: z.array(z.string().uuid()).min(1),
      dryRun: z.boolean().default(false),
    }).parse(v),
  )
  .handler(async ({ context, data }) => {
    if (data.secundarios_ids.includes(data.principal_id)) {
      throw new Error("O tema principal não pode estar entre os secundários.");
    }
    const ids = [data.principal_id, ...data.secundarios_ids];
    const { data: temas, error: te } = await context.supabase
      .from("temas").select("id,nome,slug,tipo").in("id", ids);
    if (te) throw te;
    const principal = temas?.find((t) => t.id === data.principal_id);
    const secundarios = temas?.filter((t) => data.secundarios_ids.includes(t.id)) ?? [];
    if (!principal) throw new Error("Tema principal não encontrado.");

    const { data: vinculos, error: ve } = await context.supabase
      .from("post_temas").select("post_id,tema_id").in("tema_id", ids).range(0, 99999);
    if (ve) throw ve;
    const jaNoPrincipal = new Set((vinculos ?? []).filter((v: any) => v.tema_id === data.principal_id).map((v: any) => v.post_id));
    const postsDosSecundarios = new Set((vinculos ?? []).filter((v: any) => v.tema_id !== data.principal_id).map((v: any) => v.post_id));
    let vaoSerMovidas = 0;
    postsDosSecundarios.forEach((pid) => { if (!jaNoPrincipal.has(pid)) vaoSerMovidas += 1; });

    if (data.dryRun) {
      return {
        ok: true,
        dryRun: true as const,
        principal,
        secundarios,
        totalPostsSecundarios: postsDosSecundarios.size,
        vaoSerMovidas,
        totalPrincipalDepois: jaNoPrincipal.size + vaoSerMovidas,
      };
    }

    const { data: movidas, error } = await context.supabase.rpc("mesclar_temas" as any, {
      _principal: data.principal_id,
      _secundarios: data.secundarios_ids,
    });
    if (error) throw error;
    return { ok: true, dryRun: false as const, principal, secundarios, matériasMovidas: movidas ?? 0 };
  });

// Possíveis duplicados: agrupa por nome normalizado exato + heurística de substring.
export const listarPossiveisDuplicados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const all: Array<{ id: string; nome: string; slug: string; tipo: string }> = [];
    let from = 0; const size = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await context.supabase
        .from("temas").select("id,nome,slug,tipo").order("nome").range(from, from + size - 1);
      if (error) throw error;
      const rows = (data ?? []) as any;
      all.push(...rows);
      if (rows.length < size) break;
      from += size;
    }
    const counts = await contarPorTemas(context.supabase, all.map((t) => t.id));
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    const porChave = new Map<string, typeof all>();
    for (const t of all) {
      const k = norm(t.nome);
      if (!k) continue;
      const arr = porChave.get(k) ?? [];
      arr.push(t);
      porChave.set(k, arr);
    }

    const grupos: Array<{ chave: string; itens: Array<{ id: string; nome: string; slug: string; tipo: string; total: number }> }> = [];
    const jaAgrupados = new Set<string>();
    for (const [k, itens] of porChave) {
      if (itens.length > 1) {
        itens.forEach((t) => jaAgrupados.add(t.id));
        grupos.push({ chave: k, itens: itens.map((t) => ({ ...t, total: counts.get(t.id) ?? 0 })) });
      }
    }

    // Substring: nome contido em outro (mínimo 4 chars).
    const normArr = all.map((t) => ({ t, k: norm(t.nome) })).filter((x) => x.k.length >= 4);
    normArr.sort((a, b) => a.k.length - b.k.length);
    for (let i = 0; i < normArr.length; i++) {
      const base = normArr[i];
      if (jaAgrupados.has(base.t.id)) continue;
      const relacionados = [base.t];
      for (let j = i + 1; j < normArr.length; j++) {
        const cand = normArr[j];
        if (jaAgrupados.has(cand.t.id)) continue;
        if (cand.k === base.k) continue;
        if ((cand.k.includes(base.k) || base.k.includes(cand.k)) && Math.abs(cand.k.length - base.k.length) <= 20) {
          relacionados.push(cand.t);
        }
      }
      if (relacionados.length > 1) {
        relacionados.forEach((t) => jaAgrupados.add(t.id));
        grupos.push({
          chave: `~${base.k}`,
          itens: relacionados.map((t) => ({ ...t, total: counts.get(t.id) ?? 0 })),
        });
      }
    }

    grupos.sort((a, b) => {
      const sa = a.itens.reduce((n, x) => n + x.total, 0);
      const sb = b.itens.reduce((n, x) => n + x.total, 0);
      return sb - sa;
    });
    return grupos.slice(0, 200);
  });

// ============ CONFIG ============
export const listConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("configuracoes").select("*");
    if (error) throw error;
    const map: Record<string, any> = {};
    (data ?? []).forEach((c: any) => { map[c.chave] = c.valor; });
    return map;
  });

export const saveConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ chave: z.string().min(1), valor: z.any() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("configuracoes")
      .upsert({ chave: data.chave, valor: data.valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw error;
    return { ok: true };
  });

// ============ CONTATOS ============
export const listContatos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contatos").select("*").order("criado_em", { ascending: false }).limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const marcarContatoLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), lido: z.boolean() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("contatos").update({ lido: data.lido }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ DASHBOARD ============
export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ count: publicados }, { count: rascunhos }, { count: temas }, { count: contatos }] = await Promise.all([
      context.supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "publicado"),
      context.supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "rascunho"),
      context.supabase.from("temas").select("*", { count: "exact", head: true }),
      context.supabase.from("contatos").select("*", { count: "exact", head: true }).eq("lido", false),
    ]);
    return {
      publicados: publicados ?? 0,
      rascunhos: rascunhos ?? 0,
      temas: temas ?? 0,
      contatosNaoLidos: contatos ?? 0,
    };
  });

// ============ UPLOAD (signed URL) ============
export const criarUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ nomeArquivo: z.string().min(1).max(200) }).parse(v))
  .handler(async ({ context, data }) => {
    const ext = data.nomeArquivo.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: signed, error } = await context.supabase.storage
      .from("midia")
      .createSignedUploadUrl(key);
    if (error) throw error;
    // URL pública (bucket privado ainda expõe leitura via storage policy)
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/midia/${key}`;
    return { key, uploadUrl: signed.signedUrl, token: signed.token, publicUrl };
  });

// ============ BUSCA DE POSTS (para picker da manchete) ============
export const searchAdminPostsByTitle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ q: z.string().max(200).default("") }).parse(v ?? {}))
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("posts")
      .select("id,titulo,slug,imagem_capa,publicado_em,status")
      .eq("status", "publicado")
      .order("publicado_em", { ascending: false })
      .limit(20);
    if (data.q.trim()) query = query.ilike("titulo", `%${data.q.trim()}%`);
    const { data: items, error } = await query;
    if (error) throw error;
    return items ?? [];
  });

export const getAdminPostSimple = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { data: p } = await context.supabase
      .from("posts")
      .select("id,titulo,slug,imagem_capa,publicado_em,status")
      .eq("id", data.id)
      .maybeSingle();
    return p ?? null;
  });

// ============ AUTORES ============
const autorInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(160),
  slug: z.string().min(1).max(160),
  bio: z.string().max(4000).optional().nullable(),
  bio_curta: z.string().max(500).optional().nullable(),
  bio_media: z.string().max(1500).optional().nullable(),
  bio_longa: z.string().max(8000).optional().nullable(),
  cargo: z.string().max(200).optional().nullable(),
  formacao: z.string().max(300).optional().nullable(),
  competencias: z.string().max(500).optional().nullable(),
  linkedin_url: z.string().url().optional().nullable().or(z.literal("")),
  foto_url: z.string().url().optional().nullable().or(z.literal("")),
  links: z.record(z.string(), z.string()).default({}),
  outros_links: z.record(z.string(), z.string()).default({}),
  fotos: z.array(z.string().url()).default([]),
  linha_do_tempo: z.array(z.object({ ano: z.string().max(20), texto: z.string().max(500) })).default([]),
});

const AUTOR_COLS = "id,nome,slug,bio,bio_curta,bio_media,bio_longa,cargo,formacao,competencias,linkedin_url,foto_url,links,outros_links,fotos,linha_do_tempo,criado_em";

export const listAutores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("autores")
      .select(AUTOR_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const getAutor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { data: aut, error } = await context.supabase
      .from("autores")
      .select(AUTOR_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return aut ?? null;
  });

export const saveAutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => autorInput.parse(v))
  .handler(async ({ context, data }) => {
    const payload = {
      nome: data.nome,
      slug: data.slug,
      bio: data.bio || null,
      bio_curta: data.bio_curta || null,
      bio_media: data.bio_media || null,
      bio_longa: data.bio_longa || null,
      cargo: data.cargo || null,
      formacao: data.formacao || null,
      competencias: data.competencias || null,
      linkedin_url: data.linkedin_url || null,
      foto_url: data.foto_url || null,
      links: data.links ?? {},
      outros_links: data.outros_links ?? {},
      fotos: data.fotos ?? [],
      linha_do_tempo: data.linha_do_tempo ?? [],
    };
    if (data.id) {
      const { error } = await context.supabase.from("autores").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("autores").insert(payload).select("id").single();
    if (error) throw error;
    return { id: created.id };
  });

export const deleteAutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("autores").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
