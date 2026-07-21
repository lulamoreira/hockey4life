import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type OrdemListagem = "desc" | "asc";

export type HomeSettings = {
  ordem: OrdemListagem;
  manchete: { modo: "auto" | "fixa"; post_id: string | null; fixada_em: string | null };
  quantidades: {
    home_grade: number;
    leia_agora: number;
    arquivo: number;
    tema: number;
    leia_tambem: number;
    nao_perca: number;
  };
  nao_perca: { ativo: boolean; modo: "recentes" | "manual" };
};

export const HOME_SETTINGS_PADRAO: HomeSettings = {
  ordem: "desc",
  manchete: { modo: "auto", post_id: null, fixada_em: null },
  quantidades: { home_grade: 12, leia_agora: 5, arquivo: 12, tema: 12, leia_tambem: 3, nao_perca: 6 },
  nao_perca: { ativo: true, modo: "manual" },
};

function clamp(n: any, min: number, max: number, def: number) {
  const v = Number.isFinite(Number(n)) ? Math.floor(Number(n)) : def;
  return Math.min(max, Math.max(min, v));
}

function normalizeHomeSettings(raw: any): HomeSettings {
  const s = raw ?? {};
  const q = s.quantidades ?? {};
  const np = s.nao_perca ?? {};
  const m = s.manchete ?? {};
  return {
    ordem: s.ordem === "asc" ? "asc" : "desc",
    manchete: {
      modo: m.modo === "fixa" ? "fixa" : "auto",
      post_id: typeof m.post_id === "string" ? m.post_id : null,
      fixada_em: typeof m.fixada_em === "string" ? m.fixada_em : null,
    },
    quantidades: {
      home_grade: clamp(q.home_grade, 3, 48, 12),
      leia_agora: clamp(q.leia_agora, 1, 20, 5),
      arquivo: clamp(q.arquivo, 6, 48, 12),
      tema: clamp(q.tema, 6, 48, 12),
      leia_tambem: clamp(q.leia_tambem, 1, 12, 3),
      nao_perca: clamp(q.nao_perca, 1, 20, 6),
    },
    nao_perca: {
      ativo: np.ativo !== false,
      modo: np.modo === "recentes" ? "recentes" : "manual",
    },
  };
}

async function readHomeSettings(sb: ReturnType<typeof publicClient>): Promise<HomeSettings> {
  const { data } = await sb.from("configuracoes").select("valor").eq("chave", "home_ordenacao").maybeSingle();
  return normalizeHomeSettings(data?.valor);
}

export type PostListItem = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  imagem_capa: string | null;
  credito_imagem: string | null;
  publicado_em: string | null;
  destaque: boolean;
  nao_perca: boolean;
  temas: Array<{ nome: string; slug: string; tipo: "time" | "assunto" }>;
};

export type PostFull = PostListItem & {
  conteudo: string | null;
  atualizado_em: string;
};

const POST_COLS = "id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca";

async function attachTemas(sb: ReturnType<typeof publicClient>, posts: any[]): Promise<any[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const { data: rels } = await sb
    .from("post_temas")
    .select("post_id, temas(nome, slug, tipo)")
    .in("post_id", ids);
  const map = new Map<string, any[]>();
  (rels ?? []).forEach((r: any) => {
    if (!r.temas) return;
    const arr = map.get(r.post_id) ?? [];
    arr.push(r.temas);
    map.set(r.post_id, arr);
  });
  return posts.map((p) => ({ ...p, temas: map.get(p.id) ?? [] }));
}

export const listPosts = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(50).optional(),
    }).default({ page: 1 }).parse(v ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const settings = await readHomeSettings(sb);
    const perPage = data.perPage ?? settings.quantidades.arquivo;
    const asc = settings.ordem === "asc";
    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const { data: posts, count, error } = await sb
      .from("posts")
      .select(POST_COLS, { count: "exact" })
      .eq("status", "publicado")
      .lte("publicado_em", new Date().toISOString())
      .order("publicado_em", { ascending: asc })
      .order("id", { ascending: asc })
      .range(from, to);
    if (error) throw error;
    const items = await attachTemas(sb, posts ?? []);
    return {
      items: items as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    };
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const now = new Date().toISOString();
  const settings = await readHomeSettings(sb);
  const asc = settings.ordem === "asc";
  const qt = settings.quantidades;

  // Base: matérias publicadas mais recentes (ou mais antigas), quantidade suficiente
  // para preencher manchete + leia_agora + grade.
  const totalNecessario = 1 + qt.leia_agora + qt.home_grade + 4;

  const naoPercaQuery = sb
    .from("posts")
    .select("id,titulo,slug,publicado_em")
    .eq("status", "publicado")
    .lte("publicado_em", now)
    .order("publicado_em", { ascending: asc })
    .order("id", { ascending: asc })
    .limit(qt.nao_perca);

  const [{ data: recentes }, { data: temasMenu }, { data: config }, { data: naoPercaData }] =
    await Promise.all([
      sb
        .from("posts")
        .select(POST_COLS)
        .eq("status", "publicado")
        .lte("publicado_em", now)
        .order("publicado_em", { ascending: asc })
        .order("id", { ascending: asc })
        .limit(totalNecessario),
      sb
        .from("temas")
        .select("nome,slug,tipo,destaque_menu,ordem")
        .order("ordem", { ascending: true }),
      sb.from("configuracoes").select("chave,valor"),
      settings.nao_perca.ativo
        ? settings.nao_perca.modo === "manual"
          ? sb
              .from("posts")
              .select("id,titulo,slug,publicado_em")
              .eq("status", "publicado")
              .eq("nao_perca", true)
              .lte("publicado_em", now)
              .order("publicado_em", { ascending: false })
              .order("id", { ascending: false })
              .limit(qt.nao_perca)
          : naoPercaQuery
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const configMap: Record<string, any> = {};
  (config ?? []).forEach((c: any) => { configMap[c.chave] = c.valor; });

  // Manchete
  let manchete: any = null;
  if (settings.manchete.modo === "fixa" && settings.manchete.post_id) {
    const { data: fixado } = await sb
      .from("posts")
      .select(POST_COLS)
      .eq("id", settings.manchete.post_id)
      .eq("status", "publicado")
      .lte("publicado_em", now)
      .maybeSingle();
    if (fixado) {
      const [withTemas] = await attachTemas(sb, [fixado]);
      manchete = withTemas;
    }
  }

  const recentesList = await attachTemas(sb, recentes ?? []);
  if (!manchete) manchete = recentesList[0] ?? null;

  const restantes = manchete ? recentesList.filter((p: any) => p.id !== manchete.id) : recentesList;

  return {
    destaque: manchete as PostListItem | null,
    leiaAgora: restantes.slice(0, qt.leia_agora) as PostListItem[],
    ultimas: restantes.slice(0, qt.home_grade) as PostListItem[],
    naoPerca: (naoPercaData ?? []) as Array<{ id: string; titulo: string; slug: string; publicado_em: string | null }>,
    temasMenu: (temasMenu ?? []) as Array<{ nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number }>,
    config: configMap,
  };
});

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ slug: z.string().min(1) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const now = new Date().toISOString();
    const settings = await readHomeSettings(sb);
    const asc = settings.ordem === "asc";
    const limite = settings.quantidades.leia_tambem;

    const { data: post, error } = await sb
      .from("posts")
      .select("id,titulo,slug,resumo,conteudo,imagem_capa,credito_imagem,publicado_em,atualizado_em,destaque,nao_perca,status")
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .lte("publicado_em", now)
      .maybeSingle();
    if (error) throw error;
    if (!post) return null;
    const [withTemas] = await attachTemas(sb, [post]);

    let relacionados: PostListItem[] = [];
    if (withTemas.temas && withTemas.temas.length > 0) {
      const slugs = withTemas.temas.map((t: any) => t.slug);
      const { data: temaIds } = await sb.from("temas").select("id").in("slug", slugs);
      const ids = (temaIds ?? []).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: rel } = await sb
          .from("post_temas")
          .select("post_id, posts!inner(id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca,status)")
          .in("tema_id", ids)
          .eq("posts.status", "publicado")
          .lte("posts.publicado_em", now)
          .order("posts(publicado_em)", { ascending: asc })
          .order("posts(id)", { ascending: asc })
          .limit(30);
        const seen = new Set<string>([post.id]);
        const items: any[] = [];
        (rel ?? []).forEach((r: any) => {
          if (r.posts && !seen.has(r.posts.id)) {
            seen.add(r.posts.id);
            items.push(r.posts);
          }
        });
        relacionados = (await attachTemas(sb, items.slice(0, limite))) as PostListItem[];
      }
    }

    return { post: withTemas as PostFull, relacionados };
  });

export const getPostsByTema = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({
      slug: z.string().min(1),
      tipo: z.enum(["time", "assunto"]),
      page: z.number().int().min(1).default(1),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const settings = await readHomeSettings(sb);
    const perPage = settings.quantidades.tema;
    const asc = settings.ordem === "asc";
    const { data: tema } = await sb
      .from("temas")
      .select("id,nome,slug,tipo")
      .eq("slug", data.slug)
      .eq("tipo", data.tipo)
      .maybeSingle();
    if (!tema) return { tema: null, items: [], total: 0, page: data.page, totalPages: 1, perPage };

    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const nowIso = new Date().toISOString();
    const { data: rels, count } = await sb
      .from("post_temas")
      .select("posts!inner(id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca,status)", {
        count: "exact",
      })
      .eq("tema_id", tema.id)
      .eq("posts.status", "publicado")
      .lte("posts.publicado_em", nowIso)
      .order("posts(publicado_em)", { ascending: asc })
      .order("posts(id)", { ascending: asc })
      .range(from, to);

    const posts = (rels ?? [])
      .map((r: any) => r.posts)
      .filter((p: any) => !!p);
    const withTemas = await attachTemas(sb, posts);
    return {
      tema,
      items: withTemas as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    };
  });

export const searchPosts = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ q: z.string().min(1).max(120), page: z.number().int().min(1).default(1) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const settings = await readHomeSettings(sb);
    const perPage = settings.quantidades.arquivo;
    const asc = settings.ordem === "asc";
    const from = (data.page - 1) * perPage;
    const to = from + perPage - 1;
    const q = `%${data.q}%`;
    const { data: posts, count, error } = await sb
      .from("posts")
      .select(POST_COLS, { count: "exact" })
      .eq("status", "publicado")
      .lte("publicado_em", new Date().toISOString())
      .or(`titulo.ilike.${q},resumo.ilike.${q}`)
      .order("publicado_em", { ascending: asc })
      .order("id", { ascending: asc })
      .range(from, to);
    if (error) throw error;
    const items = await attachTemas(sb, posts ?? []);
    return {
      items: items as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      q: data.q,
    };
  });

export const getSiteConfig = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ data: config }, { data: temasMenu }] = await Promise.all([
    sb.from("configuracoes").select("chave,valor"),
    sb.from("temas").select("nome,slug,tipo,destaque_menu,ordem").eq("destaque_menu", true).order("ordem"),
  ]);
  const configMap: Record<string, any> = {};
  (config ?? []).forEach((c: any) => { configMap[c.chave] = c.valor; });
  return { config: configMap, temasMenu: temasMenu ?? [] };
});

export const enviarContato = createServerFn({ method: "POST" })
  .inputValidator((v) =>
    z.object({
      nome: z.string().min(1).max(120),
      email: z.string().email().max(200),
      assunto: z.string().max(200).optional().default(""),
      mensagem: z.string().min(1).max(4000),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("contatos").insert({
      nome: data.nome,
      email: data.email,
      assunto: data.assunto || null,
      mensagem: data.mensagem,
    });
    if (error) throw new Error("Não foi possível enviar sua mensagem.");
    return { ok: true };
  });

export const listAllPublishedSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const settings = await readHomeSettings(sb);
  const asc = settings.ordem === "asc";
  const { data } = await sb
    .from("posts")
    .select("slug,publicado_em,atualizado_em")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: asc })
    .order("id", { ascending: asc })
    .limit(5000);
  return data ?? [];
});

export const listRecentForFeed = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const settings = await readHomeSettings(sb);
  const asc = settings.ordem === "asc";
  const { data } = await sb
    .from("posts")
    .select("titulo,slug,resumo,publicado_em,imagem_capa")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: asc })
    .order("id", { ascending: asc })
    .limit(30);
  return data ?? [];
});
