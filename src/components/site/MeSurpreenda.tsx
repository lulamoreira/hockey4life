import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Dices, Loader2 } from "lucide-react";
import { sortearPost } from "@/lib/descoberta.functions";

const KEY_HISTORICO = "h4l:sorteio-recentes";
const MAX_HISTORICO = 5;

function lerHistorico(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY_HISTORICO);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function salvarHistorico(id: string) {
  if (typeof window === "undefined") return;
  try {
    const atual = lerHistorico().filter((x) => x !== id);
    atual.unshift(id);
    sessionStorage.setItem(KEY_HISTORICO, JSON.stringify(atual.slice(0, MAX_HISTORICO)));
  } catch {
    /* noop */
  }
}

type Props = {
  excluirIdAtual?: string;
  variant?: "botao" | "menu" | "link";
  className?: string;
  children?: React.ReactNode;
  onNavegar?: () => void;
};

export function MeSurpreenda({ excluirIdAtual, variant = "botao", className, children, onNavegar }: Props) {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  async function sortear() {
    if (carregando) return;
    setErro(false);
    setCarregando(true);
    try {
      const excluir = new Set(lerHistorico());
      if (excluirIdAtual) excluir.add(excluirIdAtual);
      const post = await sortearPost({ data: { excluirIds: Array.from(excluir) } });
      if (!post) {
        setErro(true);
        return;
      }
      salvarHistorico(post.id);
      onNavegar?.();
      await navigate({ to: "/$slug", params: { slug: post.slug } });
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  const label = children ?? "Me surpreenda";
  const Icon = carregando ? Loader2 : Dices;
  const baseClasses =
    variant === "botao"
      ? "inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/50 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      : variant === "menu"
      ? "flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm uppercase tracking-wide hover:bg-muted"
      : "inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline";

  return (
    <>
      <button
        type="button"
        onClick={sortear}
        disabled={carregando}
        aria-label="Ler uma matéria ao acaso"
        aria-busy={carregando}
        className={`${baseClasses} disabled:cursor-wait disabled:opacity-70 ${className ?? ""}`}
      >
        <Icon className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {erro && (
        <span role="alert" className="ml-2 text-xs text-destructive">
          Não deu certo. <button type="button" className="underline" onClick={sortear}>Tentar de novo</button>
        </span>
      )}
    </>
  );
}
