import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * LGPD: apaga o perfil, roles e a conta de autenticação do próprio usuário.
 * Matérias e autoria pública (tabela `autores`) não são tocadas — o nome
 * do autor continua nas matérias já publicadas.
 */
export const apagarMinhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1) Apaga dados pessoais dentro do RLS do próprio usuário
    const { error: anonErr } = await context.supabase.rpc("anonimizar_minha_conta");
    if (anonErr) throw new Error(anonErr.message);

    // 2) Deleta a conta em auth.users com o admin client (server-only)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
