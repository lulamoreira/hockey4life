import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getMyPermissions, type Permissao } from "@/lib/equipe.functions";
import { useState } from "react";
import { LogOut, LayoutDashboard, FileText, Tag, Settings, Mail, Download, Archive, Users, CheckSquare } from "lucide-react";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { LogoImg } from "@/components/site/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Hockey4Life" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminGate,
});

function AdminGate() {
  const { session, loading } = useAuthSession();
  if (loading) return <FullScreen text="Carregando…" />;
  if (!session) return <LoginScreen />;
  return <StaffCheck />;
}

function StaffCheck() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: () => getMyRole(), retry: false });
  if (role.isLoading) return <FullScreen text="Verificando permissões…" />;
  if (role.error || !role.data?.isStaff) return <NoAccessScreen />;
  return <AdminShell />;
}

function AdminShell() {
  const router = useRouter();
  const nav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/materias", label: "Matérias", icon: FileText },
    { to: "/admin/temas", label: "Temas", icon: Tag },
    { to: "/admin/autores", label: "Autores", icon: Users },
    { to: "/admin/contatos", label: "Contatos", icon: Mail },
    { to: "/admin/importar", label: "Importar WP", icon: Download },
    { to: "/admin/backup", label: "Backup", icon: Archive },
    { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
  ];
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="p-6">
          <Link to="/" aria-label="Hockey4Life — página inicial" className="inline-block">
            <LogoImg height={28} />
          </Link>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Admin</div>
        </div>
        <nav className="px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to as any}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-primary/15 text-primary" }}
              className="mb-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-border p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.invalidate(); }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="Hockey4Life — página inicial" className="inline-block">
              <LogoImg height={22} />
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button onClick={async () => { await supabase.auth.signOut(); router.invalidate(); }} className="text-sm text-muted-foreground">Sair</button>
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-2">
            {nav.map((n) => (
              <Link key={n.to} to={n.to as any} activeOptions={{ exact: n.exact }} activeProps={{ className: "bg-primary text-primary-foreground" }} className="rounded px-2 py-1 text-xs uppercase tracking-wide">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) setMsg(error.message);
    else router.invalidate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="text-center">
          <div className="flex items-center justify-center">
            <LogoImg height={40} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Painel administrativo</p>
        </div>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
          />
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <button
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <Link to="/admin/criar-conta" className="mt-4 block text-center text-xs text-muted-foreground hover:text-primary">
          Primeiro acesso? Criar conta de administrador
        </Link>
        <Link to="/" className="mt-2 block text-center text-xs text-muted-foreground hover:text-primary">← Voltar ao site</Link>
      </div>
    </div>
  );
}

function NoAccessScreen() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="h4l-title text-3xl text-foreground">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua conta não tem permissão para acessar o painel.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={async () => { await supabase.auth.signOut(); router.invalidate(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground"
          >
            Sair
          </button>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm">Início</Link>
        </div>
      </div>
    </div>
  );
}

function FullScreen({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{text}</div>;
}
