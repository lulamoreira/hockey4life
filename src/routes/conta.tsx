import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuthSession } from "@/hooks/use-auth";
import { getMyRole } from "@/lib/admin.functions";
import { apagarMinhaConta } from "@/lib/conta.functions";
import { optimizeImage } from "@/lib/image-optim";
import { SiteLayout } from "@/components/site/SiteLayout";
import { LogOut, Shield, Trash2, Upload, User } from "lucide-react";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Hockey4Life" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Edite seu perfil, vincule métodos de login e gerencie sua conta no Hockey4Life." },
    ],
  }),
  component: Pagina,
});

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Pagina() {
  const { session, loading } = useAuthSession();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/entrar", replace: true });
  }, [loading, session, nav]);

  if (loading || !session) return null;
  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-14">
        <h1 className="h4l-title text-2xl text-primary md:text-4xl">Minha conta</h1>
        <div className="mt-6 flex flex-col gap-6">
          <BlocoPerfil userId={session.user.id} email={session.user.email ?? ""} />
          <BlocoMetodosLogin />
          <BlocoAcoes />
        </div>
      </div>
    </SiteLayout>
  );
}

function BlocoPerfil({ userId, email }: { userId: string; email: string }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("nome,telefone,data_nascimento,foto_url").eq("id", userId).maybeSingle();
      if (!data) return;
      setNome(data.nome ?? "");
      setTelefone(data.telefone ? mascaraTelefone(data.telefone) : "");
      setNascimento(data.data_nascimento ?? "");
      setFotoUrl((data as any).foto_url ?? null);
    })();
  }, [userId]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg("");
    const digitos = telefone.replace(/\D/g, "");
    if (!nome.trim()) return setErro("Nome é obrigatório.");
    if (digitos.length < 10) return setErro("Telefone incompleto.");
    if (!nascimento) return setErro("Informe a data de nascimento.");
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({
      nome: nome.trim(),
      telefone: digitos,
      data_nascimento: nascimento,
    }).eq("id", userId);
    setSalvando(false);
    if (error) setErro(error.message);
    else setMsg("Perfil atualizado.");
  }

  async function trocarFoto(file: File) {
    setErro(""); setMsg("");
    try {
      const optim = await optimizeImage(file, { maxWidth: 512, quality: 0.85 });
      const ext = optim.main.ext;
      const caminho = `avatares/${userId}.${ext}?v=${Date.now()}`;
      const path = `avatares/${userId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("midia").upload(path, optim.main.blob, { upsert: true, contentType: optim.main.blob.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("midia").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await supabase.from("profiles").update({ foto_url: url }).eq("id", userId);
      if (profErr) throw profErr;
      setFotoUrl(url);
      setMsg("Foto atualizada.");
      void caminho;
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao enviar foto.");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="h4l-title text-lg text-foreground">Editar perfil</h2>
      <p className="mt-1 text-xs text-muted-foreground">E-mail: <span className="text-foreground">{email}</span></p>

      <div className="mt-4 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {fotoUrl ? <img src={fotoUrl} alt="Sua foto" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><User className="h-6 w-6" /></div>}
        </div>
        <div>
          <input ref={inputFotoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void trocarFoto(f); }} />
          <button type="button" onClick={() => inputFotoRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" /> Trocar foto
          </button>
        </div>
      </div>

      <form onSubmit={salvar} className="mt-5 flex flex-col gap-4">
        <Campo label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} className={inputCls} /></Campo>
        <Campo label="Telefone"><input value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} inputMode="tel" required placeholder="(11) 99999-9999" className={inputCls} /></Campo>
        <Campo label="Data de nascimento"><input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} required max={new Date().toISOString().slice(0, 10)} className={inputCls} /></Campo>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <button disabled={salvando} className="min-h-11 rounded-md bg-primary py-2.5 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </section>
  );
}

function BlocoMetodosLogin() {
  const [identidades, setIdentidades] = useState<Array<{ id: string; provider: string }>>([]);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function carregar() {
    const { data } = await supabase.auth.getUserIdentities();
    setIdentidades((data?.identities ?? []).map((i: any) => ({ id: i.identity_id ?? i.id, provider: i.provider })));
  }
  useEffect(() => { void carregar(); }, []);

  async function vincularGoogle() {
    setErro(""); setMsg("");
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin + "/conta" } });
    if (error) setErro(error.message);
  }

  async function desvincular(id: string, provider: string) {
    setErro(""); setMsg("");
    if (identidades.length <= 1) return setErro("Você precisa manter pelo menos um método de login ativo.");
    const identity = (await supabase.auth.getUserIdentities()).data?.identities?.find((i: any) => (i.identity_id ?? i.id) === id);
    if (!identity) return setErro("Método não encontrado.");
    const { error } = await supabase.auth.unlinkIdentity(identity as any);
    if (error) setErro(error.message);
    else { setMsg(`${provider} desvinculado.`); await carregar(); }
  }

  const temGoogle = identidades.some((i) => i.provider === "google");

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="h4l-title text-lg text-foreground">Métodos de login</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {identidades.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            <span className="capitalize">{i.provider}</span>
            <button type="button" disabled={identidades.length <= 1} onClick={() => desvincular(i.id, i.provider)} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive disabled:opacity-40">
              Desvincular
            </button>
          </li>
        ))}
      </ul>
      {!temGoogle && (
        <button type="button" onClick={vincularGoogle} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          Vincular conta Google
        </button>
      )}
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}
    </section>
  );
}

function BlocoAcoes() {
  const router = useRouter();
  const nav = useNavigate();
  const { session } = useAuthSession();
  const roleQ = useQuery({ queryKey: ["my-role", session?.user.id ?? "anon"], queryFn: () => getMyRole(), enabled: !!session, retry: false });
  const isStaff = !!roleQ.data?.isStaff;
  const [confirma, setConfirma] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");

  async function sair() {
    await supabase.auth.signOut();
    router.invalidate();
    nav({ to: "/", replace: true });
  }

  async function apagar() {
    setErro(""); setApagando(true);
    try {
      await apagarMinhaConta();
      await supabase.auth.signOut();
      router.invalidate();
      nav({ to: "/", replace: true });
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao apagar conta.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="h4l-title text-lg text-foreground">Conta</h2>
      <div className="mt-3 flex flex-col gap-2">
        {isStaff && (
          <Link to="/admin" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20">
            <Shield className="h-4 w-4" /> Ir para o admin
          </Link>
        )}
        <button type="button" onClick={sair} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>

      <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-destructive">Apagar minha conta</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Apaga seus dados pessoais e sua conta de login. Matérias já publicadas com seu nome como autor(a) permanecem no ar — apenas a ligação pessoal com sua conta é removida.
        </p>
        {!confirma ? (
          <button type="button" onClick={() => setConfirma(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="h-4 w-4" /> Quero apagar minha conta
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={apagar} disabled={apagando} className="min-h-11 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
              {apagando ? "Apagando…" : "Confirmar exclusão"}
            </button>
            <button type="button" onClick={() => setConfirma(false)} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
          </div>
        )}
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const inputCls = "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:border-primary focus:outline-none";
