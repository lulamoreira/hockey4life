import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { formatDataBR } from "@/lib/slugify";

interface ComentarioPublico { id: string; nome: string; texto: string; criado_em: string; user_id: string | null }

/**
 * Comentários da matéria. Qualquer pessoa pode enviar (logada ou anônima);
 * tudo nasce "pendente" e só aparece depois de aprovado no painel (RLS garante).
 */
export function Comentarios({ postId, className = "" }: { postId: string; className?: string }) {
  const { session } = useAuthSession();
  const lista = useQuery({
    queryKey: ["comentarios", postId],
    queryFn: async (): Promise<ComentarioPublico[]> => {
      const { data, error } = await supabase
        .from("comentarios")
        .select("id, nome, texto, criado_em, user_id")
        .eq("post_id", postId)
        .eq("status", "aprovado")
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const nomeLogado = (session?.user.user_metadata?.full_name as string | undefined) ?? (session?.user.user_metadata?.name as string | undefined) ?? "";
  const [anonimo, setAnonimo] = useState(false);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [isca, setIsca] = useState(""); // campo invisível anti-robô
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "erro">("idle");
  const [erro, setErro] = useState("");

  const identificado = !!session && !anonimo;
  const nomeFinal = identificado ? (nome.trim() || nomeLogado || "Leitor") : (nome.trim() || "Anônimo");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (isca) { setEstado("ok"); return; }
    if (texto.trim().length < 2) { setErro("Escreva seu comentário."); return; }
    if (texto.length > 2000) { setErro("Máximo de 2.000 caracteres."); return; }
    setEstado("enviando");
    const { error } = await supabase.from("comentarios").insert({
      post_id: postId,
      user_id: identificado ? session!.user.id : null,
      nome: nomeFinal.slice(0, 60).padEnd(2, "."),
      texto: texto.trim(),
    });
    if (error) { setEstado("erro"); setErro("Não foi possível enviar. Tente de novo."); return; }
    setTexto(""); setEstado("ok");
  };

  const campo = "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const itens = lista.data ?? [];

  return (
    <section aria-labelledby="comentarios-titulo" className={`${className} border-t border-border pt-6`}>
      <h2 id="comentarios-titulo" className="flex items-center gap-2 font-display text-2xl uppercase">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden /> Comentários {itens.length > 0 && <span className="text-muted-foreground">({itens.length})</span>}
      </h2>

      {lista.isLoading ? (
        <div className="mt-4 h-16 animate-pulse rounded-md bg-muted" />
      ) : itens.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Ainda não há comentários. Seja o primeiro.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {itens.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-foreground">{c.nome}</span>
                {c.user_id && <UserCheck className="h-4 w-4 text-primary" aria-label="Leitor cadastrado" />}
                <span className="text-xs text-muted-foreground">· {formatDataBR(c.criado_em)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}

      {estado === "ok" ? (
        <div role="status" className="mt-6 rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
          Obrigado! Seu comentário foi enviado e vai aparecer aqui depois de aprovado pela equipe.
          <button type="button" onClick={() => setEstado("idle")} className="ml-2 font-bold text-primary underline">Escrever outro</button>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-3" noValidate>
          {session && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} className="h-4 w-4 accent-primary" />
              Comentar como anônimo
            </label>
          )}
          <div>
            <label htmlFor="com-nome" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {identificado ? "Nome exibido" : "Seu nome (opcional — vazio fica “Anônimo”)"}
            </label>
            <input id="com-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60}
              placeholder={identificado ? nomeLogado || "Seu nome" : "Anônimo"} className={campo} />
          </div>
          <input tabIndex={-1} autoComplete="off" aria-hidden value={isca} onChange={(e) => setIsca(e.target.value)} className="hidden" name="site" />
          <div>
            <label htmlFor="com-texto" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Comentário</label>
            <textarea id="com-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={2000} className={campo} />
            <div className="mt-1 text-right text-xs text-muted-foreground">{texto.length}/2000</div>
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={estado === "enviando"}
              className="min-h-11 rounded-md bg-primary px-5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60">
              {estado === "enviando" ? "Enviando…" : "Enviar comentário"}
            </button>
            <span className="text-xs text-muted-foreground">Comentários passam por aprovação antes de aparecer.</span>
          </div>
        </form>
      )}
    </section>
  );
}
