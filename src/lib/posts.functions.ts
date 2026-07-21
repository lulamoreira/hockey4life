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
export type LetreiroDirecao = "rtl" | "ltr" | "up" | "down";
export type TransicaoManchete = "rtl" | "ltr" | "up" | "down" | "fade";

export type LetreiroSettings = {
  ativo: boolean;
  rotulo: string;
  quantidade: number;
  origem: "recentes" | "manual";
  direcao: LetreiroDirecao;
  velocidade: number; // segundos (por volta em horizontal; por manchete em vertical)
};

export type CarrosselSettings = {
  quantidade: number;      // 1..10 — com 1 fica estático
  transicao: TransicaoManchete;
  intervalo: number;       // segundos por slide (3..30)
  duracaoMs: number;       // duração da transição (200..1500)
  fixadaComRodizio: boolean; // se há manchete fixa: participa ou fica sozinha
};

export type HomeSettings = {
  ordem: OrdemListagem;
  manchete: { modo: "auto" | "fixa"; post_id: string | null; fixada_em: string | null };
  carrossel: CarrosselSettings;
  quantidades: {
    home_grade: number;
    leia_agora: number;
    arquivo: number;
    tema: number;
    leia_tambem: number;
    nao_perca: number;
  };
  // "nao_perca" mantido para compat retroativa (ativo/modo)
  nao_perca: { ativo: boolean; modo: "recentes" | "manual" };
  letreiro: LetreiroSettings;
};

export const LETREIRO_PADRAO: LetreiroSettings = {
  ativo: true,
  rotulo: "NÃO PERCA",
  quantidade: 5,
  origem: "recentes",
  direcao: "rtl",
  velocidade: 30,
};

export const CARROSSEL_PADRAO: CarrosselSettings = {
  quantidade: 5,
  transicao: "rtl",
  intervalo: 7,
  duracaoMs: 600,
  fixadaComRodizio: true,
};

export const HOME_SETTINGS_PADRAO: HomeSettings = {
  ordem: "desc",
  manchete: { modo: "auto", post_id: null, fixada_em: null },
  carrossel: CARROSSEL_PADRAO,
  quantidades: { home_grade: 12, leia_agora: 5, arquivo: 12, tema: 12, leia_tambem: 3, nao_perca: 6 },
  nao_perca: { ativo: true, modo: "recentes" },
  letreiro: LETREIRO_PADRAO,
};

function clamp(n: unknown, min: number, max: number, def: number): number {
  const v = Number.isFinite(Number(n)) ? Math.floor(Number(n)) : def;
  return Math.min(max, Math.max(min, v));
}

function normalizeLetreiro(raw: any, fallbackModo: "recentes" | "manual" = "recentes"): LetreiroSettings {
  const l = raw ?? {};
  const dir = ["rtl", "ltr", "up", "down"].includes(l.direcao) ? l.direcao : LETREIRO_PADRAO.direcao;
  return {
    ativo: l.ativo !== false,
    rotulo: typeof l.rotulo === "string" && l.rotulo.trim() ? l.rotulo.trim().slice(0, 40) : LETREIRO_PADRAO.rotulo,
    quantidade: clamp(l.quantidade, 3, 15, LETREIRO_PADRAO.quantidade),
    origem: l.origem === "manual" ? "manual" : (l.origem === "recentes" ? "recentes" : fallbackModo),
    direcao: dir as LetreiroDirecao,
    velocidade: clamp(l.velocidade, 3, 60, LETREIRO_PADRAO.velocidade),
  };
}

function normalizeHomeSettings(raw: any): HomeSettings {
  const s = raw ?? {};
  const q = s.quantidades ?? {};
  const np = s.nao_perca ?? {};
  const m = s.manchete ?? {};
  // Migração suave: se letreiro não existir, herda do bloco antigo nao_perca
  const letreiroRaw = s.letreiro ?? {
    ativo: np.ativo,
    origem: np.modo,
  };
  const naoPercaModo = np.modo === "manual" ? "manual" : "recentes";
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
      modo: naoPercaModo,
    },
    letreiro: normalizeLetreiro(letreiroRaw, naoPercaModo),
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

type SB = ReturnType<typeof publicClient>;

async function attachTemas(sb: SB, posts: any[]): Promise<any[]> {
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

// =============================================================
// getHomeData / listPosts / getPostsByTema
// =============================================================

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
  const letreiro = settings.letreiro;

  const totalNecessario = 1 + qt.leia_agora + qt.home_grade + 4;

  const letreiroPromise = letreiro.ativo
    ? letreiro.origem === "manual"
      ? sb
          .from("posts")
          .select("id,titulo,slug,publicado_em")
          .eq("status", "publicado")
          .eq("nao_perca", true)
          .lte("publicado_em", now)
          .order("publicado_em", { ascending: false })
          .order("id", { ascending: false })
          .limit(letreiro.quantidade)
      : sb
          .from("posts")
          .select("id,titulo,slug,publicado_em")
          .eq("status", "publicado")
          .lte("publicado_em", now)
          .order("publicado_em", { ascending: false })
          .order("id", { ascending: false })
          .limit(letreiro.quantidade)
    : Promise.resolve({ data: [] as any[] });

  const [{ data: recentes }, { data: temasMenu }, { data: config }, { data: letreiroData }] =
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
      letreiroPromise,
    ]);

  const configMap: Record<string, any> = {};
  (config ?? []).forEach((c: any) => { configMap[c.chave] = c.valor; });

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
    naoPerca: (letreiroData ?? []) as Array<{ id: string; titulo: string; slug: string; publicado_em: string | null }>,
    letreiro,
    temasMenu: (temasMenu ?? []) as Array<{ nome: string; slug: string; tipo: "time" | "assunto"; destaque_menu: boolean; ordem: number }>,
    config: configMap,
  };
});

// =============================================================
// Post individual + relacionados por temas em comum + adjacentes
// =============================================================

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((v) => z.object({ slug: z.string().min(1) }).parse(v))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const now = new Date().toISOString();
    const settings = await readHomeSettings(sb);
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

    // Relacionados: por qtde de temas em comum, empate por data desc
    let relacionados: PostListItem[] = [];
    const temasDoPost: Array<{ slug: string; tipo: string }> = withTemas.temas ?? [];
    if (temasDoPost.length > 0) {
      const slugs = temasDoPost.map((t) => t.slug);
      const { data: temaIds } = await sb.from("temas").select("id").in("slug", slugs);
      const ids = (temaIds ?? []).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: rel } = await sb
          .from("post_temas")
          .select("post_id, tema_id, posts!inner(id,titulo,slug,resumo,imagem_capa,credito_imagem,publicado_em,destaque,nao_perca,status)")
          .in("tema_id", ids)
          .eq("posts.status", "publicado")
          .lte("posts.publicado_em", now)
          .limit(300);
        const scoreMap = new Map<string, { post: any; score: number }>();
        (rel ?? []).forEach((r: any) => {
          if (!r.posts || r.posts.id === post.id) return;
          const prev = scoreMap.get(r.posts.id);
          if (prev) prev.score += 1;
          else scoreMap.set(r.posts.id, { post: r.posts, score: 1 });
        });
        const ordenados = Array.from(scoreMap.values())
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const da = new Date(a.post.publicado_em ?? 0).getTime();
            const db = new Date(b.post.publicado_em ?? 0).getTime();
            return db - da;
          })
          .slice(0, limite)
          .map((x) => x.post);
        relacionados = (await attachTemas(sb, ordenados)) as PostListItem[];
      }
    }
    // Fallback: mais recentes se não houver relacionados
    if (relacionados.length === 0) {
      const { data: fallback } = await sb
        .from("posts")
        .select(POST_COLS)
        .eq("status", "publicado")
        .lte("publicado_em", now)
        .neq("id", post.id)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite);
      relacionados = (await attachTemas(sb, fallback ?? [])) as PostListItem[];
    }

    // Adjacentes (anterior/próximo) por data
    const [{ data: prevRow }, { data: nextRow }] = await Promise.all([
      sb.from("posts")
        .select("titulo,slug,publicado_em")
        .eq("status", "publicado")
        .lte("publicado_em", now)
        .lt("publicado_em", post.publicado_em!)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(1).maybeSingle(),
      sb.from("posts")
        .select("titulo,slug,publicado_em")
        .eq("status", "publicado")
        .lte("publicado_em", now)
        .gt("publicado_em", post.publicado_em!)
        .order("publicado_em", { ascending: true })
        .order("id", { ascending: true })
        .limit(1).maybeSingle(),
    ]);

    return {
      post: withTemas as PostFull,
      relacionados,
      anterior: prevRow ?? null,
      proximo: nextRow ?? null,
    };
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
    if (!tema) return { tema: null, items: [], total: 0, page: data.page, totalPages: 1, perPage, ultimaData: null as string | null };

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

    const posts = (rels ?? []).map((r: any) => r.posts).filter((p: any) => !!p);
    const withTemas = await attachTemas(sb, posts);

    // Data da matéria mais recente do tema
    const { data: ultimo } = await sb
      .from("post_temas")
      .select("posts!inner(publicado_em,status)")
      .eq("tema_id", tema.id)
      .eq("posts.status", "publicado")
      .lte("posts.publicado_em", nowIso)
      .order("posts(publicado_em)", { ascending: false })
      .limit(1).maybeSingle();
    const ultimaData: string | null = (ultimo as any)?.posts?.publicado_em ?? null;

    return {
      tema,
      items: withTemas as PostListItem[],
      total: count ?? 0,
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      ultimaData,
    };
  });

// =============================================================
// Busca com relevância (RPC buscar_posts / listar_arquivo)
// =============================================================

type BuscaRow = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  imagem_capa: string | null;
  credito_imagem: string | null;
  publicado_em: string | null;
  rank: number;
  trecho: string | null;
  total: number;
};

export const searchPosts = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({
      q: z.string().max(120).default(""),
      page: z.number().int().min(1).default(1),
      ordem: z.enum(["rel", "desc", "asc"]).default("rel"),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const settings = await readHomeSettings(sb);
    const perPage = settings.quantidades.arquivo;

    const { data: rows, error } = await sb.rpc("buscar_posts", {
      _q: data.q,
      _tema_ids: undefined,
      _ordem: data.ordem,
      _page: data.page,
      _per_page: perPage,
    });
    if (error) throw error;
    const list = (rows ?? []) as BuscaRow[];
    const total = list[0]?.total ?? 0;
    const items = await attachTemas(sb, list.map(({ rank, trecho, total: _t, ...p }) => p));
    const merged = items.map((p, i) => ({ ...p, rank: list[i].rank, trecho: list[i].trecho })) as Array<PostListItem & { rank: number; trecho: string | null }>;

    // Sugestões quando nada encontrado
    let sugestoes: Array<{ nome: string; slug: string; tipo: string; total: number }> = [];
    if (data.q && total === 0) {
      const { data: temas } = await sb.rpc("contagem_temas");
      const q = data.q.toLowerCase();
      sugestoes = ((temas ?? []) as any[])
        .filter((t) => t.total > 0 && (t.nome.toLowerCase().includes(q) || q.includes(t.nome.toLowerCase())))
        .slice(0, 5);
    }

    return {
      items: merged,
      total: Number(total),
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil(Number(total) / perPage)),
      q: data.q,
      ordem: data.ordem,
      sugestoes,
    };
  });

// =============================================================
// Arquivo com filtros combinados
// =============================================================

export const listArchive = createServerFn({ method: "GET" })
  .inputValidator((v) =>
    z.object({
      q: z.string().max(120).default(""),
      temas: z.array(z.string().uuid()).default([]),
      ano: z.number().int().min(2000).max(3000).nullable().optional(),
      mes: z.number().int().min(1).max(12).nullable().optional(),
      ordem: z.enum(["desc", "asc", "rel"]).default("desc"),
      page: z.number().int().min(1).default(1),
    }).parse(v ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const settings = await readHomeSettings(sb);
    const perPage = settings.quantidades.arquivo;
    const ordem = data.ordem === "rel" && !data.q ? "desc" : data.ordem;

    const { data: rows, error } = await sb.rpc("listar_arquivo", {
      _q: data.q,
      _tema_ids: data.temas.length > 0 ? data.temas : undefined,
      _ano: data.ano ?? undefined,
      _mes: data.mes ?? undefined,
      _ordem: ordem,
      _page: data.page,
      _per_page: perPage,
    });
    if (error) throw error;
    const list = (rows ?? []) as BuscaRow[];
    const total = list[0]?.total ?? 0;
    const items = await attachTemas(sb, list.map(({ rank, trecho, total: _t, ...p }) => p));
    const merged = items.map((p, i) => ({ ...p, rank: list[i].rank, trecho: list[i].trecho })) as Array<PostListItem & { rank: number; trecho: string | null }>;

    return {
      items: merged,
      total: Number(total),
      page: data.page,
      perPage,
      totalPages: Math.max(1, Math.ceil(Number(total) / perPage)),
      ordem,
    };
  });

// =============================================================
// Navegação: painel de anos/meses, índice de temas
// =============================================================

export const getArchiveNav = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.rpc("contagem_arquivo");
  if (error) throw error;
  return (data ?? []) as Array<{ ano: number; mes: number; total: number }>;
});

export const getTemasIndex = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.rpc("contagem_temas");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; nome: string; slug: string; tipo: string; total: number }>;
});

export const listTemasParaFiltro = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb.rpc("contagem_temas");
  return ((data ?? []) as Array<{ id: string; nome: string; slug: string; tipo: string; total: number }>)
    .filter((t) => t.total > 0);
});

// =============================================================
// getSiteConfig, contato, sitemap, feed
// =============================================================

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
  const { data } = await sb
    .from("posts")
    .select("slug,publicado_em,atualizado_em")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(5000);
  return data ?? [];
});

export const listRecentForFeed = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb
    .from("posts")
    .select("titulo,slug,resumo,publicado_em,imagem_capa")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  return data ?? [];
});

export const getRecentesFallback = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb
    .from("posts")
    .select("id,titulo,slug,publicado_em,imagem_capa")
    .eq("status", "publicado")
    .lte("publicado_em", new Date().toISOString())
    .order("publicado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(5);
  return data ?? [];
});
