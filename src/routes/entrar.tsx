import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthSession } from "@/hooks/use-auth";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Hockey4Life" },
      { name: "description", content: "Entre na sua conta do Hockey4Life por Google, link mágico por e-mail ou senha. Ler o site é livre; a conta é opcional." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Entrar — Hockey4Life" },
      { property: "og:description", content: "Entre na sua conta do Hockey4Life. Cadastrar é rápido e opcional." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { session, loading } = useAuthSession();
  const nav = useNavigate();
  const [modo, setModo] = useState<"opcoes" | "magic" | "senha">("opcoes");

  // Ao logar, decidir destino: perfil incompleto → completar; senão → conta
  useEffect(() => {
    if (loading || !session) return;
    (async () => {
      const { data } = await supabase.rpc("perfil_completo", { _id: session.user.id });
      if (data === true) nav({ to: "/conta", replace: true });
      else nav({ to: "/completar-perfil", replace: true });
    })();
  }, [loading, session, nav]);

  if (loading) return null;
  if (session) return null;

  return (
    <SiteLayout>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10 md:py-16">
        <h1 className="h4l-title text-3xl text-primary md:text-4xl">Entrar</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Ler o Hockey4Life é livre. Uma conta é opcional e ajuda a personalizar sua experiência.
        </p>

        <div className="mt-6 w-full rounded-lg border border-border bg-card p-6">
          {modo === "opcoes" && (
            <div className="flex flex-col gap-3">
              <BotaoGoogle />
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={() => setModo("magic")}
                className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-foreground hover:bg-muted"
              >
                Receber link por e-mail
              </button>
              <button
                type="button"
                onClick={() => setModo("senha")}
                className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-foreground hover:bg-muted"
              >
                Entrar com e-mail e senha
              </button>
            </div>
          )}

          {modo === "magic" && <FormMagic voltar={() => setModo("opcoes")} />}
          {modo === "senha" && <FormSenha voltar={() => setModo("opcoes")} />}
        </div>

        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-primary">← Voltar ao site</Link>
      </div>
    </SiteLayout>
  );
}

function BotaoGoogle() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar() {
    setLoading(true); setErro("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/entrar",
      });
      if (result.error) setErro(result.error.message || "Falha ao entrar com Google.");
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        disabled={loading}
        className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[#1f1f1f] shadow-sm hover:bg-white/90 disabled:opacity-50"
      >
        <GoogleIcon /> {loading ? "Abrindo…" : "Continuar com Google"}
      </button>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </>
  );
}

function FormMagic({ voltar }: { voltar: () => void }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg(""); setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/entrar" },
    });
    setLoading(false);
    if (error) setErro(error.message);
    else setMsg("Enviamos um link para o seu e-mail. Abra no mesmo aparelho para continuar.");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">E-mail</label>
      <input
        type="email" required autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
        className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button disabled={loading} className="min-h-11 rounded-md bg-primary py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {loading ? "Enviando…" : "Enviar link"}
      </button>
      <button type="button" onClick={voltar} className="text-xs text-muted-foreground hover:text-primary">← Outras opções</button>
    </form>
  );
}

function FormSenha({ voltar }: { voltar: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setLoading(false);
    if (error) setErro(error.message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">E-mail</label>
      <input
        type="email" required autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
        className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none"
      />
      <label className="text-xs uppercase tracking-widest text-muted-foreground">Senha</label>
      <input
        type="password" required autoComplete="current-password"
        value={senha} onChange={(e) => setSenha(e.target.value)}
        className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <button disabled={loading} className="min-h-11 rounded-md bg-primary py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <button type="button" onClick={voltar} className="text-xs text-muted-foreground hover:text-primary">← Outras opções</button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.3 35.5 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 32.9C9.4 39.5 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.1C41.1 35.3 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
