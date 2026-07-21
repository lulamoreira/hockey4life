import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FORMATO_VERSAO = "h4l-backup/1";
const PART_SIZE = 200;

async function requireAdmin(context: any) {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Somente administradores podem executar essa operação.");
}

// ============ EXPORTAÇÃO CONTEÚDO ============

// Retorna resumo + manifesto para saber quantas partes serão geradas.
export const backupInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const [{ count: posts }, { count: temas }, { count: contatos }] = await Promise.all([
      context.supabase.from("posts").select("*", { count: "exact", head: true }),
      context.supabase.from("temas").select("*", { count: "exact", head: true }),
      context.supabase.from("contatos").select("*", { count: "exact", head: true }),
    ]);
    const totalPosts = posts ?? 0;
    const partes = Math.max(1, Math.ceil(totalPosts / PART_SIZE));
    return {
      formato: FORMATO_VERSAO,
      partSize: PART_SIZE,
      totalPosts,
      totalTemas: temas ?? 0,
      totalContatos: contatos ?? 0,
      partes,
    };
  });

// Exporta uma parte de posts (paginada). Ordenação estável para consistência.
export const backupPartePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ parte: z.number().int().min(1) }).parse(v))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const from = (data.parte - 1) * PART_SIZE;
    const to = from + PART_SIZE - 1;
    const { data: posts, error, count } = await context.supabase
      .from("posts")
      .select("id,wp_id,titulo,slug,resumo,conteudo,imagem_capa,credito_imagem,autor_id,status,destaque,nao_perca,publicado_em,criado_em,atualizado_em", { count: "exact" })
      .order("criado_em", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const ids = (posts ?? []).map((p) => p.id);
    let rels: any[] = [];
    if (ids.length) {
      const { data: pt, error: e2 } = await context.supabase
        .from("post_temas").select("post_id,tema_id").in("post_id", ids);
      if (e2) throw e2;
      rels = pt ?? [];
    }
    return { parte: data.parte, total: count ?? 0, posts: posts ?? [], post_temas: rels };
  });

// Exporta metadados (temas + configuracoes + opcional contatos).
export const backupMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ incluirContatos: z.boolean().default(false) }).parse(v ?? {}))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: temas, error: e1 } = await context.supabase.from("temas").select("*").order("nome");
    if (e1) throw e1;
    const { data: configs, error: e2 } = await context.supabase.from("configuracoes").select("*");
    if (e2) throw e2;
    let contatos: any[] | null = null;
    if (data.incluirContatos) {
      const { data: c, error: e3 } = await context.supabase.from("contatos").select("*").order("criado_em", { ascending: true });
      if (e3) throw e3;
      contatos = c ?? [];
    }
    return { temas: temas ?? [], configuracoes: configs ?? [], contatos };
  });

// ============ MÍDIA ============
// Lista arquivos do bucket 'midia' agrupados por ano (wp/AAAA/...).
export const backupMidiaManifesto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const supabaseUrl = process.env.SUPABASE_URL!;
    const grupos: Record<string, { arquivos: any[]; total: number; bytes: number }> = {};
    // Percorre pastas em wp/
    const { data: anos, error } = await context.supabase.storage.from("midia").list("wp", { limit: 1000 });
    if (error) throw error;
    for (const anoDir of anos ?? []) {
      if (!anoDir.name || anoDir.id) continue; // pula arquivos soltos
      const ano = anoDir.name;
      grupos[ano] = { arquivos: [], total: 0, bytes: 0 };
      let offset = 0;
      while (true) {
        const { data: files, error: e2 } = await context.supabase.storage
          .from("midia").list(`wp/${ano}`, { limit: 1000, offset });
        if (e2) throw e2;
        if (!files || files.length === 0) break;
        for (const f of files) {
          if (f.id === null) continue; // subpasta
          const path = `wp/${ano}/${f.name}`;
          const size = (f.metadata as any)?.size ?? 0;
          grupos[ano].arquivos.push({
            caminho: path,
            tamanho: size,
            atualizado: f.updated_at ?? f.created_at ?? null,
            url: `${supabaseUrl}/storage/v1/object/public/midia/${path}`,
          });
          grupos[ano].total++;
          grupos[ano].bytes += size;
        }
        if (files.length < 1000) break;
        offset += files.length;
      }
    }
    return { grupos, gerado_em: new Date().toISOString() };
  });

// ============ RESTAURAÇÃO ============
const postBackupSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  wp_id: z.number().int().optional().nullable(),
  titulo: z.string(),
  slug: z.string(),
  resumo: z.string().optional().nullable(),
  conteudo: z.string().optional().nullable(),
  imagem_capa: z.string().optional().nullable(),
  credito_imagem: z.string().optional().nullable(),
  status: z.enum(["rascunho", "publicado"]),
  destaque: z.boolean().optional().default(false),
  nao_perca: z.boolean().optional().default(false),
  publicado_em: z.string().optional().nullable(),
  criado_em: z.string().optional().nullable(),
  atualizado_em: z.string().optional().nullable(),
});

const restoreInput = z.object({
  posts: z.array(postBackupSchema),
  post_temas: z.array(z.object({ post_id: z.string().uuid(), tema_id: z.string().uuid() })).optional().default([]),
  temas: z.array(z.any()).optional().default([]),
  configuracoes: z.array(z.object({ chave: z.string(), valor: z.any() })).optional().default([]),
});

// Simulação: não escreve nada. Retorna o que aconteceria.
export const simularRestauracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => restoreInput.parse(v))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    // Busca todos os posts atuais (id, wp_id, slug, titulo, publicado_em)
    const atuais: { id: string; wp_id: number | null; slug: string; titulo: string; publicado_em: string | null }[] = [];
    let page = 0;
    while (true) {
      const from = page * 1000;
      const { data: rows, error } = await context.supabase
        .from("posts")
        .select("id,wp_id,slug,titulo,publicado_em")
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      atuais.push(...rows);
      if (rows.length < 1000) break;
      page++;
    }
    const porWp = new Map<number, typeof atuais[number]>();
    const porSlug = new Map<string, typeof atuais[number]>();
    atuais.forEach((p) => {
      if (p.wp_id != null) porWp.set(p.wp_id, p);
      porSlug.set(p.slug, p);
    });

    let criadas = 0;
    let atualizadas = 0;
    const sobrescritas: { slug: string; titulo: string; publicado_em: string | null }[] = [];
    const slugsBackup = new Set<string>();
    for (const p of data.posts) {
      slugsBackup.add(p.slug);
      const existente = (p.wp_id != null && porWp.get(p.wp_id)) || porSlug.get(p.slug);
      if (existente) {
        atualizadas++;
        sobrescritas.push({ slug: p.slug, titulo: p.titulo, publicado_em: p.publicado_em ?? null });
      } else {
        criadas++;
      }
    }
    const apagariam = atuais.filter((p) => !slugsBackup.has(p.slug)).map((p) => ({ slug: p.slug, titulo: p.titulo }));
    return {
      totalNoBanco: atuais.length,
      totalNoBackup: data.posts.length,
      criadas,
      atualizadas,
      intactas: atuais.length - atualizadas,
      apagariamSeSubstituir: apagariam.length,
      sobrescritas: sobrescritas.slice(0, 200),
      exemplosApagados: apagariam.slice(0, 50),
      temasNoBackup: data.temas.length,
      configsNoBackup: data.configuracoes.length,
    };
  });

const applyInput = restoreInput.extend({
  modo: z.enum(["mesclar", "substituir"]),
  confirmacao: z.string().optional(),
});

export const aplicarRestauracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => applyInput.parse(v))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    if (data.modo === "substituir" && data.confirmacao !== "SUBSTITUIR") {
      throw new Error("Confirme digitando SUBSTITUIR para o modo de substituição.");
    }

    let criadas = 0;
    let atualizadas = 0;
    let apagadas = 0;

    // 1) Temas: upsert por slug
    if (data.temas.length) {
      const rows = data.temas.map((t: any) => ({
        nome: t.nome, slug: t.slug, tipo: t.tipo,
        destaque_menu: t.destaque_menu ?? false, ordem: t.ordem ?? 0,
        wp_tag_id: t.wp_tag_id ?? null,
      }));
      const { error } = await context.supabase.from("temas").upsert(rows, { onConflict: "slug" });
      if (error) throw error;
    }

    // 2) Configuracoes: upsert por chave
    for (const c of data.configuracoes) {
      await context.supabase.from("configuracoes").upsert(
        { chave: c.chave, valor: c.valor, atualizado_em: new Date().toISOString() },
        { onConflict: "chave" },
      );
    }

    // 3) Posts: upsert em lotes de 100 por slug
    const slugsBackup = new Set<string>();
    // mapa post_id do backup -> tema_ids
    const relsMap = new Map<string, string[]>();
    for (const r of data.post_temas ?? []) {
      const arr = relsMap.get(r.post_id) ?? [];
      arr.push(r.tema_id);
      relsMap.set(r.post_id, arr);
    }

    for (let i = 0; i < data.posts.length; i += 100) {
      const chunk = data.posts.slice(i, i + 100);
      const slugs = chunk.map((p) => p.slug);
      slugs.forEach((s) => slugsBackup.add(s));
      const { data: existentes } = await context.supabase
        .from("posts").select("id,slug").in("slug", slugs);
      const existMap = new Map((existentes ?? []).map((e) => [e.slug, e.id]));

      const paraUpsert = chunk.map((p) => ({
        wp_id: p.wp_id ?? null,
        titulo: p.titulo,
        slug: p.slug,
        resumo: p.resumo ?? null,
        conteudo: p.conteudo ?? null,
        imagem_capa: p.imagem_capa ?? null,
        credito_imagem: p.credito_imagem ?? null,
        status: p.status,
        destaque: false, // nunca fixar via restauração
        nao_perca: p.nao_perca ?? false,
        publicado_em: p.publicado_em ?? null,
      }));

      const { data: upserted, error } = await context.supabase
        .from("posts").upsert(paraUpsert, { onConflict: "slug" }).select("id,slug");
      if (error) throw error;

      for (const p of chunk) {
        if (existMap.has(p.slug)) atualizadas++;
        else criadas++;
      }

      // Re-vincular temas pelas relações do backup se os posts do backup traziam id
      // Nem sempre há mapeamento; se relsMap vazio, pula.
      if (relsMap.size > 0 && upserted) {
        // Constrói mapa slug -> novo id
        const slugToId = new Map(upserted.map((u) => [u.slug, u.id]));
        for (const p of chunk) {
          if (!p.id) continue;
          const temasDele = relsMap.get(p.id);
          if (!temasDele || !temasDele.length) continue;
          const newId = slugToId.get(p.slug);
          if (!newId) continue;
          await context.supabase.from("post_temas").delete().eq("post_id", newId);
          // Só insere referências para temas que existem
          const { data: temasExistentes } = await context.supabase
            .from("temas").select("id").in("id", temasDele);
          const validos = (temasExistentes ?? []).map((t) => t.id);
          if (validos.length) {
            await context.supabase.from("post_temas").insert(
              validos.map((tid) => ({ post_id: newId, tema_id: tid })),
            );
          }
        }
      }
    }

    // 4) Substituir: apaga posts que não estão no backup
    if (data.modo === "substituir") {
      const slugs = Array.from(slugsBackup);
      // Deleta em lotes para evitar URL enorme
      let deletados = 0;
      for (let i = 0; i < 1000; i++) {
        const { data: alvos, error } = await context.supabase
          .from("posts").select("id,slug").not("slug", "in", `(${slugs.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",") || '""'})`)
          .limit(500);
        if (error) throw error;
        if (!alvos || alvos.length === 0) break;
        const ids = alvos.map((a) => a.id);
        const { error: eDel } = await context.supabase.from("posts").delete().in("id", ids);
        if (eDel) throw eDel;
        deletados += ids.length;
        if (alvos.length < 500) break;
      }
      apagadas = deletados;
    }

    // Log
    const { data: userInfo } = await context.supabase.auth.getUser();
    await context.supabase.from("restauracao_log").insert({
      usuario_id: context.userId,
      usuario_email: userInfo?.user?.email ?? null,
      modo: data.modo,
      criadas, atualizadas, apagadas,
      observacao: `posts backup=${data.posts.length}, temas=${data.temas.length}, configs=${data.configuracoes.length}`,
    });

    return { criadas, atualizadas, apagadas };
  });

// Log de restaurações
export const listarRestauracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("restauracao_log").select("*").order("criado_em", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  });

// ============ BACKUPS AUTOMÁTICOS (bucket privado 'backups') ============
export const listarBackupsAutomaticos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase.storage
      .from("backups").list("auto", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    const arquivos = (data ?? []).filter((f) => f.id !== null).map((f) => ({
      nome: f.name,
      criado_em: f.created_at,
      tamanho: (f.metadata as any)?.size ?? 0,
    }));
    return arquivos;
  });

export const urlBackupAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ nome: z.string().min(1) }).parse(v))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: signed, error } = await context.supabase.storage
      .from("backups").createSignedUrl(`auto/${data.nome}`, 600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const baixarBackupAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ nome: z.string().min(1) }).parse(v))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: file, error } = await context.supabase.storage
      .from("backups").download(`auto/${data.nome}`);
    if (error) throw error;
    const text = await file.text();
    return JSON.parse(text);
  });
