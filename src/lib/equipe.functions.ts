import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PERMISSOES = [
  "escrever",
  "enviar_para_revisao",
  "publicar_propria",
  "editar_qualquer",
  "aprovar",
  "publicar_qualquer",
  "gerenciar_temas",
  "gerenciar_usuarios",
  "gerenciar_configuracoes",
  "gerenciar_midia",
  "ver_painel",
] as const;
export type Permissao = (typeof PERMISSOES)[number];

// -------------------- Permissões do usuário atual --------------------
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ur } = await context.supabase
      .from("user_roles")
      .select("role, papel_id, papeis:papel_id(slug, nome, permissoes)")
      .eq("user_id", context.userId)
      .maybeSingle();
    const papel = (ur as any)?.papeis ?? null;
    const isAdmin = (ur as any)?.role === "admin" || papel?.slug === "administrador";
    const permsRaw = (papel?.permissoes ?? {}) as Record<string, boolean>;
    const perms: Record<Permissao, boolean> = Object.fromEntries(
      PERMISSOES.map((p) => [p, isAdmin || permsRaw[p] === true]),
    ) as any;
    return {
      userId: context.userId,
      isAdmin,
      isStaff: isAdmin || perms.ver_painel,
      papel: papel ? { slug: papel.slug, nome: papel.nome } : null,
      perms,
    };
  });

// -------------------- Papéis --------------------
export const listPapeis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("papeis")
      .select("id,nome,slug,descricao,sistema,permissoes,criado_em")
      .order("sistema", { ascending: false })
      .order("nome");
    if (error) throw error;
    return data ?? [];
  });

const papelInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  descricao: z.string().max(300).nullable().optional(),
  permissoes: z.record(z.string(), z.boolean()).default({}),
});

export const savePapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => papelInput.parse(v))
  .handler(async ({ context, data }) => {
    const payload: any = {
      nome: data.nome,
      slug: data.slug,
      descricao: data.descricao ?? null,
      permissoes: data.permissoes,
    };
    if (data.id) {
      const { error } = await context.supabase.from("papeis").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: c, error } = await context.supabase
      .from("papeis").insert(payload).select("id").single();
    if (error) throw error;
    return { id: c.id };
  });

export const deletePapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { data: p } = await context.supabase
      .from("papeis").select("sistema").eq("id", data.id).maybeSingle();
    if ((p as any)?.sistema) throw new Error("Papel do sistema não pode ser excluído.");
    const { error } = await context.supabase.from("papeis").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------------------- Usuários --------------------
export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      q: z.string().default(""),
      apenasEquipe: z.boolean().default(false),
    }).parse(v ?? {}),
  )
  .handler(async ({ context, data }) => {
    // Autorização defensiva: apenas quem tem gerenciar_usuarios pode listar.
    const { data: perm } = await context.supabase.rpc("tem_permissao" as any, {
      _user_id: context.userId, _permissao: "gerenciar_usuarios",
    });
    if (!perm) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Lista usuários do Auth (paginação simples: primeiros 200)
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const ids = (users?.users ?? []).map((u) => u.id);
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id,nome,foto_url").in("id", ids);
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id,role,papel_id, papeis:papel_id(slug,nome)").in("user_id", ids);
    const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const roleById = new Map((roles ?? []).map((r: any) => [r.user_id, r]));
    let items = (users?.users ?? []).map((u) => {
      const r = roleById.get(u.id);
      const papel = r?.papeis ?? null;
      const slug = papel?.slug ?? (r?.role === "admin" ? "administrador" : r?.role === "editor" ? "editor" : null);
      const p = profById.get(u.id) as any;
      return {
        id: u.id,
        email: u.email,
        criado_em: u.created_at,
        ultimo_login: u.last_sign_in_at,
        nome: p?.nome ?? null,
        foto_url: p?.foto_url ?? null,
        papel_slug: slug,
        papel_nome: papel?.nome ?? (slug === "administrador" ? "Administrador" : slug === "editor" ? "Editor" : slug ? slug : "Leitor"),
      };
    });
    if (data.q.trim()) {
      const qq = data.q.trim().toLowerCase();
      items = items.filter((u) =>
        (u.email ?? "").toLowerCase().includes(qq) || (u.nome ?? "").toLowerCase().includes(qq),
      );
    }
    if (data.apenasEquipe) items = items.filter((u) => u.papel_slug && u.papel_slug !== "leitor");
    items.sort((a, b) => (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? ""));
    return items;
  });

export const atribuirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      user_id: z.string().uuid(),
      papel_id: z.string().uuid().nullable(),
    }).parse(v),
  )
  .handler(async ({ context, data }) => {
    const { data: perm } = await context.supabase.rpc("tem_permissao" as any, {
      _user_id: context.userId, _permissao: "gerenciar_usuarios",
    });
    if (!perm) throw new Error("Sem permissão.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.papel_id === null) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.user_id, papel_id: data.papel_id } as any, { onConflict: "user_id" });
    if (error) throw error;

    // Se o papel escreve, garante um registro em autores vinculado ao usuário.
    const { data: papel } = await supabaseAdmin
      .from("papeis").select("permissoes").eq("id", data.papel_id).maybeSingle();
    const podeEscrever = ((papel as any)?.permissoes ?? {}).escrever === true;
    if (podeEscrever) {
      const existe = await supabaseAdmin.from("autores").select("id").eq("user_id", data.user_id).maybeSingle();
      if (!existe.data) {
        const { data: prof } = await supabaseAdmin
          .from("profiles").select("nome").eq("id", data.user_id).maybeSingle();
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
        const nome = (prof as any)?.nome ?? u?.user?.email ?? "Autor";
        const slug = nome.toString()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || `autor-${data.user_id.slice(0, 8)}`;
        await supabaseAdmin.from("autores").insert({ nome, slug, user_id: data.user_id } as any);
      }
    }
    return { ok: true };
  });

// -------------------- Fluxo de aprovação --------------------
export const filaAprovacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("posts")
      .select("id,titulo,slug,resumo,enviado_revisao_em,atualizado_em,criado_por,autor_id, autores:autor_id(nome,slug)")
      .eq("status", "em_revisao" as any)
      .order("enviado_revisao_em", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const enviarParaRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("posts")
      .update({
        status: "em_revisao" as any,
        enviado_revisao_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const aprovarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("posts")
      .update({
        status: "publicado" as any,
        publicado_em: new Date().toISOString(),
        revisor_id: context.userId,
        revisado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const rejeitarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ id: z.string().uuid(), motivo: z.string().min(3).max(1000) }).parse(v),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("posts")
      .update({
        status: "rejeitado" as any,
        motivo_rejeicao: data.motivo,
        revisor_id: context.userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
