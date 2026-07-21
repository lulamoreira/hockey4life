import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/criar-conta")({
  head: () => ({
    meta: [
      { title: "Criar primeira conta — Hockey4Life" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CriarContaPage,
});

function CriarContaPage() {
  const [staffJaExiste, setStaffJaExiste] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("existe_staff");
      if (!mounted) return;
      if (error) {
        setErro("Não foi possível verificar o status. Recarregue a página.");
        setStaffJaExiste(false);
        return;
      }
      setStaffJaExiste(Boolean(data));
    })();
    return () => { mounted = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(""); setMsg(""); setLoading(true);
    try {
      // Cadastro
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      if (signUpError) throw signUpError;

      // Se não há sessão (confirmação por e-mail exigida), tenta login direto —
      // caso o projeto esteja com auto-confirm, isso funciona; caso contrário,
      // pede confirmação por e-mail.
      let session = signUpData.session;
      if (!session) {
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (loginErr) {
          setMsg("Conta criada. Confirme o e-mail para continuar. Depois acesse /admin.");
          setLoading(false);
          return;
        }
        session = loginData.session;
      }

      // Chama o RPC no servidor. Só promove se ainda não existir admin.
      const { data: promoteResult, error: promoteError } = await supabase.rpc("criar_primeiro_admin");
      if (promoteError) throw promoteError;

      if (promoteResult === true) {
        setMsg("Administrador criado com sucesso! Redirecionando…");
        setTimeout(() => router.navigate({ to: "/admin" }), 800);
      } else {
        setErro("Já existe um administrador. Esta tela não pode mais ser usada.");
      }
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="h4l-title text-2xl text-primary">HOCKEY</span>
            <span className="h4l-title text-2xl">4LIFE</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Primeiro acesso ao painel
          </p>
        </div>

        {staffJaExiste === null && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Verificando…</p>
        )}

        {staffJaExiste === true && (
          <div className="mt-8 text-center">
            <h1 className="h4l-title text-xl text-foreground">O acesso já foi configurado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A conta de administrador principal já foi criada. Use a tela de login para entrar.
            </p>
            <Link
              to="/admin"
              className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            >
              Ir para o login
            </Link>
          </div>
        )}

        {staffJaExiste === false && (
          <>
            <p className="mt-6 text-sm text-muted-foreground">
              Nenhum administrador foi configurado ainda. Crie a conta principal preenchendo os
              campos abaixo. Esta tela desaparece automaticamente depois do primeiro cadastro.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="password" required minLength={8} autoComplete="new-password"
                value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha (mínimo 8 caracteres)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              {msg && <p className="text-sm text-primary">{msg}</p>}
              <button
                disabled={loading}
                className="w-full rounded-md bg-primary py-2.5 font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Criando…" : "Criar conta de administrador"}
              </button>
            </form>
          </>
        )}

        <Link to="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-primary">
          ← Voltar ao site
        </Link>
      </div>
    </div>
  );
}
