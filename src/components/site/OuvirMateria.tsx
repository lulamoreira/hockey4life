import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Pause, Play, Square } from "lucide-react";

type Props = {
  titulo: string;
  html: string;
};

const VEL_KEY = "h4l-voz-velocidade";
const VELOCIDADES = [0.8, 1, 1.25, 1.5] as const;
type StatusLeitura = "parado" | "lendo" | "pausado";

/** Extrai texto puro do HTML da matéria, na ordem, pulando figuras/legendas/scripts/iframes. */
function extrairTexto(html: string): string {
  if (typeof document === "undefined") return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  div
    .querySelectorAll("figure, figcaption, script, style, iframe, .wp-caption-text, noscript")
    .forEach((el) => el.remove());
  const txt = div.textContent ?? "";
  return txt.replace(/\s+/g, " ").trim();
}

/** Divide texto em frases curtas (evita o corte dos ~15s do Safari iOS). */
function dividirFrases(texto: string): string[] {
  if (!texto) return [];
  // quebra por . ! ? ; e por quebras naturais; mantém frases <= ~200 chars
  const brutas = texto
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(])/g)
    .flatMap((s) => (s.length > 200 ? s.split(/(?<=,)\s+/g) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
  return brutas.length ? brutas : [texto];
}

function escolherVoz(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices();
  if (!vozes.length) return null;
  return (
    vozes.find((v) => /^pt-BR/i.test(v.lang)) ??
    vozes.find((v) => /^pt/i.test(v.lang)) ??
    vozes[0]
  );
}

export function OuvirMateria({ titulo, html }: Props) {
  const [suportado, setSuportado] = useState(false);
  const [estado, setEstado] = useState<StatusLeitura>("parado");
  const [idxAtual, setIdxAtual] = useState(0);
  const [velocidade, setVelocidade] = useState<number>(1);
  const frases = useMemo(() => {
    const corpo = extrairTexto(html);
    return dividirFrases(`${titulo}. ${corpo}`);
  }, [titulo, html]);

  const idxRef = useRef(0);
  const velRef = useRef(1);
  const statusRef = useRef<StatusLeitura>("parado");
  const sessaoRef = useRef(0);
  const utteranceAtualRef = useRef<SpeechSynthesisUtterance | null>(null);

  function definirStatus(status: StatusLeitura) {
    statusRef.current = status;
    setEstado(status);
  }

  function cancelarLeitura() {
    if (!suportado) return;
    window.speechSynthesis.cancel();
  }

  // Detecta suporte + carrega velocidade salva
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    setSuportado(true);
    const salvo = Number(localStorage.getItem(VEL_KEY));
    if (VELOCIDADES.includes(salvo as any)) {
      setVelocidade(salvo);
      velRef.current = salvo;
    }
    // pré-carrega vozes (assíncrono em muitos navegadores)
    const carregar = () => window.speechSynthesis.getVoices();
    carregar();
    window.speechSynthesis.onvoiceschanged = carregar;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Para ao desmontar / trocar de rota / fechar aba
  useEffect(() => {
    if (!suportado) return;
    const onHide = () => {
      statusRef.current = "parado";
      setEstado("parado");
      idxRef.current = 0;
      setIdxAtual(0);
      utteranceAtualRef.current = null;
      sessaoRef.current += 1;
      window.speechSynthesis.cancel();
    };
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      window.removeEventListener("pagehide", onHide);
      statusRef.current = "parado";
      utteranceAtualRef.current = null;
      sessaoRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, [suportado]);

  function tocarDe(inicio: number) {
    if (!suportado) return;
    const synth = window.speechSynthesis;
    sessaoRef.current += 1;
    const sessao = sessaoRef.current;
    // Limpa qualquer fala/fila pendente da sessão anterior antes de iniciar uma nova.
    synth.cancel();
    const voz = escolherVoz();
    idxRef.current = inicio;
    setIdxAtual(inicio);
    definirStatus("lendo");

    const falarFraseAtual = () => {
      if (statusRef.current !== "lendo" || sessaoRef.current !== sessao) return;
      const i = idxRef.current;
      if (i >= frases.length) {
        definirStatus("parado");
        setIdxAtual(0);
        idxRef.current = 0;
        utteranceAtualRef.current = null;
        return;
      }
      if (utteranceAtualRef.current) return;
      setIdxAtual(i);
      const u = new SpeechSynthesisUtterance(frases[i]);
      utteranceAtualRef.current = u;
      if (voz) u.voice = voz;
      u.lang = voz?.lang ?? "pt-BR";
      u.rate = velRef.current;
      u.onend = () => {
        if (utteranceAtualRef.current !== u) return;
        utteranceAtualRef.current = null;
        if (statusRef.current !== "lendo" || sessaoRef.current !== sessao) return;
        idxRef.current = i + 1;
        falarFraseAtual();
      };
      u.onerror = () => {
        if (utteranceAtualRef.current !== u) return;
        utteranceAtualRef.current = null;
        if (statusRef.current !== "lendo" || sessaoRef.current !== sessao) return;
        idxRef.current = i + 1;
        falarFraseAtual();
      };
      synth.speak(u);
    };

    falarFraseAtual();
  }

  function iniciar() {
    tocarDe(0);
  }

  function pausar() {
    if (!suportado) return;
    definirStatus("pausado");
    window.speechSynthesis.pause();
  }

  function continuar() {
    if (!suportado) return;
    const synth = window.speechSynthesis;
    definirStatus("lendo");
    synth.resume();
    // fallback: se não retomar em ~250ms, reinicia da frase atual
    setTimeout(() => {
      if (statusRef.current !== "lendo") return;
      if (!synth.speaking || synth.paused) {
        tocarDe(idxRef.current);
      } else {
        definirStatus("lendo");
      }
    }, 250);
  }

  function parar() {
    definirStatus("parado");
    setIdxAtual(0);
    idxRef.current = 0;
    utteranceAtualRef.current = null;
    sessaoRef.current += 1;
    cancelarLeitura();
  }

  function trocarVelocidade(v: number) {
    setVelocidade(v);
    velRef.current = v;
    try {
      localStorage.setItem(VEL_KEY, String(v));
    } catch { /* noop */ }
    if (estado !== "parado") {
      // reaplica velocidade reiniciando a partir da frase atual
      tocarDe(idxRef.current);
    }
  }

  if (!suportado) return null;

  const totalFrases = frases.length;
  const progresso = totalFrases ? Math.min(100, ((idxAtual + (estado === "lendo" ? 1 : 0)) / totalFrases) * 100) : 0;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/60 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        {estado === "parado" && (
          <button
            type="button"
            onClick={iniciar}
            aria-label="Ouvir a matéria"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Volume2 className="h-5 w-5" />
            Ouvir a matéria
          </button>
        )}
        {estado === "lendo" && (
          <button
            type="button"
            onClick={pausar}
            aria-label="Pausar leitura"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Pause className="h-5 w-5" />
            Pausar
          </button>
        )}
        {estado === "pausado" && (
          <button
            type="button"
            onClick={continuar}
            aria-label="Continuar leitura"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Play className="h-5 w-5" />
            Continuar
          </button>
        )}
        {estado !== "parado" && (
          <button
            type="button"
            onClick={parar}
            aria-label="Parar leitura"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:border-primary"
          >
            <Square className="h-4 w-4" />
            Parar
          </button>
        )}

        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Velocidade da leitura">
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => trocarVelocidade(v)}
              aria-pressed={velocidade === v}
              className={`min-h-[44px] min-w-[44px] rounded-md px-2 py-1 text-xs font-bold ${
                velocidade === v
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-foreground hover:border-primary"
              }`}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      {estado !== "parado" && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <p
            className="mt-3 rounded-md bg-primary/15 p-3 text-sm text-foreground"
            aria-live="polite"
          >
            <span className="sr-only">{estado === "lendo" ? "Lendo agora: " : "Pausado em: "}</span>
            {frases[idxAtual]}
          </p>
        </>
      )}
    </div>
  );
}
