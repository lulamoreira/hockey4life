import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/completar-perfil")({
  head: () => ({
    meta: [
      { title: "Complete seu perfil — Hockey4Life" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Finalize seu cadastro no Hockey4Life com nome, telefone e data de nascimento." },
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

function idade(iso: string): number {
  const hoje = new Date();
  const n = new Date(iso);
  let a = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) a--;
  return a;
}

function Pagina() {
  const { session, loading } = useAuthSession();
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/entrar", replace: true });
  }, [loading, session, nav]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("nome,telefone,data_nascimento,consentimento_em").eq("id", session.user.id).maybeSingle();
      if (data?.nome) setNome(data.nome);
      if (data?.telefone) setTelefone(mascaraTelefone(data.telefone));
      if (data?.data_nascimento) setNascimento(data.data_nascimento);
      if (data?.consentimento_em) setConsentimento(true);
    })();
  }, [session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Informe seu nome.");
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10) return setErro("Telefone incompleto.");
    if (!nascimento) return setErro("Informe a data de nascimento.");
    if (idade(nascimento) < 13) return setErro("Idade mínima para cadastro: 13 anos.");
    if (!consentimento) return setErro("É preciso aceitar a política de privacidade.");

    setSalvando(true);
    const { error } = await supabase.from("profiles").update({
      nome: nome.trim(),
      telefone: digitos,
      data_nascimento: nascimento,
      consentimento_em: new Date().toISOString(),
    }).eq("id", session!.user.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    nav({ to: "/conta", replace: true });
  }

  if (loading || !session) return null;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-8 md:py-14">
        <h1 className="h4l-title text-2xl text-primary md:text-4xl">Complete seu perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Precisamos de mais três informações para finalizar seu cadastro.</p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <Campo label="Nome completo">
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required maxLength={120}
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:border-primary focus:outline-none" />
          </Campo>
          <Campo label="Telefone">
            <input value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} inputMode="tel" autoComplete="tel-national" required placeholder="(11) 99999-9999"
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:border-primary focus:outline-none" />
          </Campo>
          <Campo label="Data de nascimento">
            <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} required max={new Date().toISOString().slice(0, 10)}
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:border-primary focus:outline-none" />
          </Campo>

          <label className="mt-2 flex items-start gap-3 text-sm text-foreground">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
            <span>
              Li e aceito a <Link to="/politica-de-privacidade" className="text-primary underline">política de privacidade</Link>. Autorizo o Hockey4Life a guardar meus dados de cadastro.
            </span>
          </label>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <button disabled={salvando} className="min-h-11 rounded-md bg-primary py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {salvando ? "Salvando…" : "Concluir cadastro"}
          </button>
        </form>
      </div>
    </SiteLayout>
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
