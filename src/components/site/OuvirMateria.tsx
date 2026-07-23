import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Pause, Play, Square, ArrowDownCircle } from "lucide-react";

type Props = {
  titulo: string;
  html: string;
  /** id do container do corpo da matéria — quando presente, o componente destaca a frase atual e faz auto-rolagem. */
  corpoId?: string;
};

const VEL_KEY = "h4l-voz-velocidade";
const ACOMP_KEY = "h4l-voz-acompanhar";
const VOZ_KEY = "h4l-voz-uri";
const VELOCIDADES = [0.8, 1, 1.25, 1.5] as const;
type StatusLeitura = "parado" | "lendo" | "pausado";

/** Extrai texto puro do HTML da matéria — fallback quando não há corpo no DOM. */
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
  const brutas = texto
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(])/g)
    .flatMap((s) => (s.length > 200 ? s.split(/(?<=,)\s+/g) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);
  return brutas.length ? brutas : [texto];
}

function listarVozesPt(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const todas = window.speechSynthesis.getVoices();
  const pt = todas.filter((v) => /^pt/i.test(v.lang));
  // pt-BR primeiro, depois demais pt
  pt.sort((a, b) => {
    const aBr = /^pt-BR/i.test(a.lang) ? 0 : 1;
    const bBr = /^pt-BR/i.test(b.lang) ? 0 : 1;
    if (aBr !== bBr) return aBr - bBr;
    return a.name.localeCompare(b.name);
  });
  return pt;
}

function escolherVoz(preferidaURI?: string | null): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices();
  if (!vozes.length) return null;
  if (preferidaURI) {
    const escolhida = vozes.find((v) => v.voiceURI === preferidaURI);
    if (escolhida) return escolhida;
  }
  return (
    vozes.find((v) => /^pt-BR/i.test(v.lang)) ??
    vozes.find((v) => /^pt/i.test(v.lang)) ??
    vozes[0]
  );
}

const BLOCOS_SELETOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote";
const IGNORAR_SELETOR = "figure, figcaption, script, style, iframe, noscript, .wp-caption-text";

/**
 * Envolve cada frase do container em <span data-h4l-frase="i" class="h4l-frase">.
 * Retorna a lista de frases na ordem em que foram envolvidas.
 */
function envolverFrases(container: HTMLElement, offsetIdx: number): string[] {
  const frases: string[] = [];
  let idx = offsetIdx;

  const blocos = Array.from(container.querySelectorAll<HTMLElement>(BLOCOS_SELETOR)).filter(
    (el) => !el.closest(IGNORAR_SELETOR) || el.matches(BLOCOS_SELETOR) === false ? !el.closest(IGNORAR_SELETOR) : true,
  );

  for (const bloco of blocos) {
    if (bloco.closest(IGNORAR_SELETOR)) continue;
    // coleta text nodes deste bloco (sem entrar em blocos aninhados como <li> dentro de <ul> aninhada)
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(bloco, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const parent = (n as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(IGNORAR_SELETOR)) return NodeFilter.FILTER_REJECT;
        if (parent.classList.contains("h4l-frase")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }
    if (!textNodes.length) continue;

    // combina texto para localizar limites das frases
    let combinado = "";
    const mapa: { node: Text; start: number; end: number }[] = [];
    for (const tn of textNodes) {
      const t = tn.data;
      mapa.push({ node: tn, start: combinado.length, end: combinado.length + t.length });
      combinado += t;
    }
    const trimmed = combinado.trim();
    if (!trimmed) continue;
    const partes = dividirFrases(combinado);
    if (!partes.length) continue;

    // localiza offsets [ini, fim] no combinado para cada parte
    let cursor = 0;
    const ranges: { ini: number; fim: number; texto: string }[] = [];
    for (const p of partes) {
      const pos = combinado.indexOf(p, cursor);
      if (pos < 0) continue;
      ranges.push({ ini: pos, fim: pos + p.length, texto: p });
      cursor = pos + p.length;
    }

    // envolve cada range — de trás para frente para não invalidar offsets
    for (let k = ranges.length - 1; k >= 0; k--) {
      const { ini, fim, texto } = ranges[k];
      const inicio = localizarPonto(mapa, ini);
      const final = localizarPonto(mapa, fim);
      if (!inicio || !final) continue;
      try {
        const range = document.createRange();
        range.setStart(inicio.node, inicio.offset);
        range.setEnd(final.node, final.offset);
        const span = document.createElement("span");
        span.className = "h4l-frase";
        span.setAttribute("data-h4l-frase", String(idx + k));
        span.appendChild(range.extractContents());
        range.insertNode(span);
      } catch {
        /* range inválido — pula silenciosamente */
      }
    }

    for (const r of ranges) frases.push(r.texto);
    idx += ranges.length;
  }
  return frases;
}

function localizarPonto(
  mapa: { node: Text; start: number; end: number }[],
  offset: number,
): { node: Text; offset: number } | null {
  for (const m of mapa) {
    if (offset >= m.start && offset <= m.end) {
      return { node: m.node, offset: offset - m.start };
    }
  }
  return null;
}

/** Desfaz o envolvimento das frases (usado ao desmontar). */
function desenvolver(container: HTMLElement) {
  const spans = container.querySelectorAll<HTMLElement>("span.h4l-frase");
  spans.forEach((sp) => {
    const pai = sp.parentNode;
    if (!pai) return;
    while (sp.firstChild) pai.insertBefore(sp.firstChild, sp);
    pai.removeChild(sp);
    pai.normalize?.();
  });
}

export function OuvirMateria({ titulo, html, corpoId }: Props) {
  const [suportado, setSuportado] = useState(false);
  const [estado, setEstado] = useState<StatusLeitura>("parado");
  const [idxAtual, setIdxAtual] = useState(0);
  const [velocidade, setVelocidade] = useState<number>(1);
  const [acompanhar, setAcompanhar] = useState<boolean>(true);
  const [mostrarVoltar, setMostrarVoltar] = useState(false);
  const [frases, setFrases] = useState<string[]>(() => dividirFrases(`${titulo}. ${extrairTexto(html)}`));
  const preparadoRef = useRef(false);

  const idxRef = useRef(0);
  const velRef = useRef(1);
  const statusRef = useRef<StatusLeitura>("parado");
  const sessaoRef = useRef(0);
  const utteranceAtualRef = useRef<SpeechSynthesisUtterance | null>(null);

  // auto-scroll
  const acompanharRef = useRef(true);
  const usuarioMexeuRef = useRef(false);
  const scrollProgramaticoRef = useRef(false);
  const timeoutRetomarRef = useRef<number | null>(null);
  const timeoutFimProgramaticoRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  function definirStatus(status: StatusLeitura) {
    statusRef.current = status;
    setEstado(status);
  }

  // Suporte + preferências salvas
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    setSuportado(true);
    const salvo = Number(localStorage.getItem(VEL_KEY));
    if (VELOCIDADES.includes(salvo as any)) {
      setVelocidade(salvo);
      velRef.current = salvo;
    }
    const acomp = localStorage.getItem(ACOMP_KEY);
    if (acomp === "0") {
      setAcompanhar(false);
      acompanharRef.current = false;
    }
    reducedMotionRef.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const carregar = () => window.speechSynthesis.getVoices();
    carregar();
    window.speechSynthesis.onvoiceschanged = carregar;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Detecta scroll do usuário (ignora o scroll programático)
  useEffect(() => {
    if (!suportado) return;
    const onScroll = () => {
      if (scrollProgramaticoRef.current) return;
      usuarioMexeuRef.current = true;
      if (statusRef.current === "lendo" && acompanharRef.current) setMostrarVoltar(true);
      if (timeoutRetomarRef.current) window.clearTimeout(timeoutRetomarRef.current);
      timeoutRetomarRef.current = window.setTimeout(() => {
        usuarioMexeuRef.current = false;
        if (statusRef.current === "lendo" && acompanharRef.current) {
          rolarPara(idxRef.current);
          setMostrarVoltar(false);
        }
      }, 4000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suportado]);

  // Prepara os spans no corpo da matéria (só quando começar a ouvir)
  const prepararCorpo = useCallback(() => {
    if (preparadoRef.current || !corpoId) return;
    const container = document.getElementById(corpoId);
    if (!container) return;
    const doCorpo = envolverFrases(container, 1); // idx 0 = título
    if (doCorpo.length) {
      setFrases([titulo, ...doCorpo]);
    }
    preparadoRef.current = true;
  }, [corpoId, titulo]);

  // Limpeza ao desmontar / trocar de rota
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
      if (corpoId) {
        const container = document.getElementById(corpoId);
        if (container) desenvolver(container);
      }
      if (timeoutRetomarRef.current) window.clearTimeout(timeoutRetomarRef.current);
      if (timeoutFimProgramaticoRef.current) window.clearTimeout(timeoutFimProgramaticoRef.current);
    };
  }, [suportado, corpoId]);

  function fraseElemento(i: number): HTMLElement | null {
    if (!corpoId) return null;
    const container = document.getElementById(corpoId);
    if (!container) return null;
    return container.querySelector<HTMLElement>(`span.h4l-frase[data-h4l-frase="${i}"]`);
  }

  function marcarAtual(i: number) {
    if (!corpoId) return;
    const container = document.getElementById(corpoId);
    if (!container) return;
    container.querySelectorAll("span.h4l-frase.h4l-frase-atual").forEach((el) => el.classList.remove("h4l-frase-atual"));
    const el = fraseElemento(i);
    if (el) el.classList.add("h4l-frase-atual");
  }

  function estaVisivel(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight;
    // margem de 80px para o cabeçalho fixo/barra de progresso
    return r.top >= 80 && r.bottom <= h - 40;
  }

  function rolarPara(i: number) {
    if (!acompanharRef.current) return;
    if (usuarioMexeuRef.current) return;
    const el = fraseElemento(i);
    if (!el) return;
    if (estaVisivel(el)) return;
    scrollProgramaticoRef.current = true;
    try {
      el.scrollIntoView({
        behavior: reducedMotionRef.current ? "auto" : "smooth",
        block: "center",
      });
    } catch {
      el.scrollIntoView();
    }
    if (timeoutFimProgramaticoRef.current) window.clearTimeout(timeoutFimProgramaticoRef.current);
    timeoutFimProgramaticoRef.current = window.setTimeout(() => {
      scrollProgramaticoRef.current = false;
    }, 800);
  }

  // Quando a frase atual muda, destaca e (se acompanhar) rola
  useEffect(() => {
    if (estado !== "lendo") return;
    marcarAtual(idxAtual);
    rolarPara(idxAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idxAtual, estado]);

  function tocarDe(inicio: number) {
    if (!suportado) return;
    const synth = window.speechSynthesis;
    sessaoRef.current += 1;
    const sessao = sessaoRef.current;
    synth.cancel();
    const voz = escolherVoz();
    idxRef.current = inicio;
    setIdxAtual(inicio);
    definirStatus("lendo");
    usuarioMexeuRef.current = false;
    setMostrarVoltar(false);

    const falarFraseAtual = () => {
      if (statusRef.current !== "lendo" || sessaoRef.current !== sessao) return;
      const i = idxRef.current;
      if (i >= frases.length) {
        definirStatus("parado");
        setIdxAtual(0);
        idxRef.current = 0;
        utteranceAtualRef.current = null;
        if (corpoId) {
          const container = document.getElementById(corpoId);
          container
            ?.querySelectorAll("span.h4l-frase.h4l-frase-atual")
            .forEach((el) => el.classList.remove("h4l-frase-atual"));
        }
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
    prepararCorpo();
    // recomputa frases se acabamos de preparar
    const container = corpoId ? document.getElementById(corpoId) : null;
    if (container && preparadoRef.current) {
      const spans = container.querySelectorAll<HTMLElement>("span.h4l-frase");
      if (spans.length) {
        const lista = [titulo, ...Array.from(spans).map((s) => (s.textContent ?? "").trim()).filter(Boolean)];
        setFrases(lista);
        // Adia o start um tick para o setState propagar
        setTimeout(() => tocarDe(0), 0);
        return;
      }
    }
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
    if (!suportado) return;
    window.speechSynthesis.cancel();
    if (corpoId) {
      const container = document.getElementById(corpoId);
      container
        ?.querySelectorAll("span.h4l-frase.h4l-frase-atual")
        .forEach((el) => el.classList.remove("h4l-frase-atual"));
    }
    setMostrarVoltar(false);
  }

  function trocarVelocidade(v: number) {
    setVelocidade(v);
    velRef.current = v;
    try {
      localStorage.setItem(VEL_KEY, String(v));
    } catch {
      /* noop */
    }
    if (estado !== "parado") tocarDe(idxRef.current);
  }

  function alternarAcompanhar() {
    const novo = !acompanhar;
    setAcompanhar(novo);
    acompanharRef.current = novo;
    try {
      localStorage.setItem(ACOMP_KEY, novo ? "1" : "0");
    } catch {
      /* noop */
    }
    if (!novo) setMostrarVoltar(false);
  }

  function voltarParaLeitura() {
    usuarioMexeuRef.current = false;
    if (timeoutRetomarRef.current) window.clearTimeout(timeoutRetomarRef.current);
    setMostrarVoltar(false);
    rolarPara(idxRef.current);
  }

  if (!suportado) return null;

  const totalFrases = frases.length;
  const progresso = totalFrases
    ? Math.min(100, ((idxAtual + (estado === "lendo" ? 1 : 0)) / totalFrases) * 100)
    : 0;

  return (
    <>
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

        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={acompanhar}
            onChange={alternarAcompanhar}
            className="h-4 w-4 accent-primary"
          />
          Acompanhar a leitura (rolar até a frase atual)
        </label>

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

      {mostrarVoltar && estado === "lendo" && acompanhar && (
        <button
          type="button"
          onClick={voltarParaLeitura}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg hover:opacity-90"
          aria-label="Voltar para a frase que está sendo lida"
        >
          <ArrowDownCircle className="h-5 w-5" />
          Voltar para a leitura
        </button>
      )}
    </>
  );
}
