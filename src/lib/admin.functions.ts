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
  resumo: z.string().max(1000).optional().nullable(),
  conteudo: z.string().optional().nullable(),
  imagem_capa: z.string().url().optional().nullable().or(z.literal("")),
  credito_imagem: z.string().max(200).optional().nullable(),
  status: z.enum(["rascunho", "publicado"]),
  destaque: z.boolean().default(false),
  nao_perca: z.boolean().default(false),
  publicado_em: z.string().nullable().optional(),
  temaIds: z.array(z.string().uuid()).default([]),
});

export const listAdminPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      status: z.enum(["todos", "rascunho", "publicado"]).default("todos"),
      q: z.string().default(""),
      page: z.number().int().min(1).default(1),
    }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    const perPage = 25;
    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    let q = context.supabase
      .from("posts")
      .select("id,titulo,slug,status,destaque,nao_perca,publicado_em,atualizado_em", { count: "exact" })
      .order("atualizado_em", { ascending: false })
      .range(from, to);
    if (data.status !== "todos") q = q.eq("status", data.status);
    if (data.q) q = q.ilike("titulo", `%${data.q}%`);
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
      .select("*")
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
      autor_id: context.userId,
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
export const listTemas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("temas")
      .select("*")
      .order("tipo").order("ordem").order("nome");
    if (error) throw error;
    return data ?? [];
  });

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

export const deleteTema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("temas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
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
