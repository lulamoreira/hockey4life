import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "h4l-theme";

type Tema = "claro" | "escuro";

function lerTemaInicial(): Tema {
  if (typeof document === "undefined") return "escuro";
  return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}

/**
 * Botão de alternância de tema (claro/escuro).
 * - Sem escolha manual: segue prefers-color-scheme e reage a mudanças do sistema.
 * - Após clicar: escolha manual passa a valer e é salva em localStorage.
 * - O ícone indica o destino do clique (lua = ir para escuro; sol = ir para claro).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<Tema>("escuro");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setTema(lerTemaInicial());
    setPronto(true);
    // Sem "seguir o sistema": o padrão do H4L é escuro; a única fonte de
    // verdade além disso é a escolha manual salva em localStorage.
  }, []);

  function aplicarTema(t: Tema) {
    const root = document.documentElement;
    if (t === "escuro") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = t === "escuro" ? "dark" : "light";
  }

  function alternar() {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    aplicarTema(proximo);
    try {
      localStorage.setItem(STORAGE_KEY, proximo === "escuro" ? "dark" : "light");
    } catch {}
    setTema(proximo);
  }

  const irPara: Tema = tema === "escuro" ? "claro" : "escuro";
  const label = irPara === "claro" ? "Mudar para tema claro" : "Mudar para tema escuro";
  // Ícone mostra o destino do clique.
  const Icone = irPara === "claro" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {pronto ? <Icone className="h-4 w-4" /> : <span className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
