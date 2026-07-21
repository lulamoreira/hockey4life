import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listConfig, saveConfig, searchAdminPostsByTitle, getAdminPostSimple } from "@/lib/admin.functions";
import { HOME_SETTINGS_PADRAO, LETREIRO_PADRAO, CARROSSEL_PADRAO, TIMES_CARROSSEL_PADRAO, type HomeSettings, type LetreiroDirecao, type TransicaoManchete, type CarrosselSettings, type TimesCarrosselSettings, type TimesDirecao } from "@/lib/posts.functions";
import { Letreiro } from "@/components/site/Letreiro";
import { TimesCarrossel } from "@/components/site/TimesCarrossel";

import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

type Tab = "geral" | "home" | "aparencia";

function ConfigPage() {
  const [tab, setTab] = useState<Tab>("geral");

  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Configurações</h1>
      <p className="text-sm text-muted-foreground">Textos do site, regras de ordenação da home e aparência.</p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        <TabBtn active={tab === "geral"} onClick={() => setTab("geral")}>Textos e contato</TabBtn>
        <TabBtn active={tab === "home"} onClick={() => setTab("home")}>Home e ordenação</TabBtn>
        <TabBtn active={tab === "aparencia"} onClick={() => setTab("aparencia")}>Aparência</TabBtn>
      </div>

      <div className="mt-6">
        {tab === "geral" ? <GeralTab /> : tab === "home" ? <HomeTab /> : <AparenciaTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
        active ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================
 * ABA 1 — Textos gerais (o que já existia)
 * ============================================================ */
function GeralTab() {
  const qc = useQueryClient();
  const save = useServerFn(saveConfig);
  const { data } = useQuery({ queryKey: ["admin-config"], queryFn: () => listConfig() });

  const [hfc, setHfc] = useState({ video_url: "", titulo: "", texto: "" });
  const [rodape, setRodape] = useState({ texto: "", creditos: "" });
  const [contato, setContato] = useState({ email: "" });
  const [redes, setRedes] = useState({ instagram: "", facebook: "", x: "", youtube: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!data) return;
    setHfc((s) => ({ ...s, ...(data.hockey_fights_cancer ?? {}) }));
    setRodape((s) => ({ ...s, ...(data.rodape ?? {}) }));
    setContato((s) => ({ ...s, ...(data.contato ?? {}) }));
    setRedes((s) => ({ ...s, ...(data.redes_sociais ?? {}) }));
  }, [data]);

  const saveAll = async () => {
    setMsg("");
    await Promise.all([
      save({ data: { chave: "hockey_fights_cancer", valor: hfc } }),
      save({ data: { chave: "rodape", valor: rodape } }),
      save({ data: { chave: "contato", valor: contato } }),
      save({ data: { chave: "redes_sociais", valor: redes } }),
    ]);
    qc.invalidateQueries({ queryKey: ["admin-config"] });
    qc.invalidateQueries({ queryKey: ["site-config"] });
    qc.invalidateQueries({ queryKey: ["home"] });
    setMsg("Configurações salvas.");
  };

  return (
    <div className="space-y-6">
      <Section title="Hockey Fights Cancer">
        <Input label="URL do vídeo (embed)" value={hfc.video_url} onChange={(v)=>setHfc({...hfc, video_url:v})} />
        <Input label="Título" value={hfc.titulo} onChange={(v)=>setHfc({...hfc, titulo:v})} />
        <TextArea label="Texto" value={hfc.texto} onChange={(v)=>setHfc({...hfc, texto:v})} />
      </Section>
      <Section title="Rodapé">
        <TextArea label="Texto" value={rodape.texto} onChange={(v)=>setRodape({...rodape, texto:v})} />
        <Input label="Créditos" value={rodape.creditos} onChange={(v)=>setRodape({...rodape, creditos:v})} />
      </Section>
      <Section title="Contato">
        <Input label="E-mail" value={contato.email} onChange={(v)=>setContato({email:v})} />
      </Section>
      <Section title="Redes sociais">
        <Input label="Instagram" value={redes.instagram} onChange={(v)=>setRedes({...redes, instagram:v})} />
        <Input label="Facebook" value={redes.facebook} onChange={(v)=>setRedes({...redes, facebook:v})} />
        <Input label="X (Twitter)" value={redes.x} onChange={(v)=>setRedes({...redes, x:v})} />
        <Input label="YouTube" value={redes.youtube} onChange={(v)=>setRedes({...redes, youtube:v})} />
      </Section>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button onClick={saveAll} className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90">
        Salvar tudo
      </button>
    </div>
  );
}

/* ============================================================
 * ABA 2 — Home e ordenação
 * ============================================================ */
function HomeTab() {
  const qc = useQueryClient();
  const save = useServerFn(saveConfig);
  const { data, isLoading } = useQuery({ queryKey: ["admin-config"], queryFn: () => listConfig() });

  const [s, setS] = useState<HomeSettings>(HOME_SETTINGS_PADRAO);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    const raw = data.home_ordenacao ?? {};
    setS({
      ordem: raw.ordem === "asc" ? "asc" : "desc",
      manchete: {
        modo: raw.manchete?.modo === "fixa" ? "fixa" : "auto",
        post_id: raw.manchete?.post_id ?? null,
        fixada_em: raw.manchete?.fixada_em ?? null,
      },
      carrossel: { ...HOME_SETTINGS_PADRAO.carrossel, ...(raw.carrossel ?? {}) },
      quantidades: { ...HOME_SETTINGS_PADRAO.quantidades, ...(raw.quantidades ?? {}) },
      nao_perca: { ...HOME_SETTINGS_PADRAO.nao_perca, ...(raw.nao_perca ?? {}) },
      letreiro: { ...HOME_SETTINGS_PADRAO.letreiro, ...(raw.letreiro ?? {}) },
      times: { ...HOME_SETTINGS_PADRAO.times, ...(raw.times ?? {}) },

    });
  }, [data]);

  const saveAll = async () => {
    setMsg("");
    await save({ data: { chave: "home_ordenacao", valor: s } });
    qc.invalidateQueries({ queryKey: ["admin-config"] });
    qc.invalidateQueries({ queryKey: ["site-config"] });
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["arquivo"] });
    qc.invalidateQueries({ queryKey: ["tema"] });
    qc.invalidateQueries({ queryKey: ["busca"] });
    setMsg("Configurações salvas.");
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      {/* Ordem */}
      <Section
        title="Ordem das listagens"
        onReset={() => setS({ ...s, ordem: HOME_SETTINGS_PADRAO.ordem })}
      >
        <div className="space-y-2">
          <RadioRow
            name="ordem"
            value="desc"
            checked={s.ordem === "desc"}
            onChange={(v) => setS({ ...s, ordem: v as any })}
            label="Mais recentes primeiro"
            hint="Padrão. Vale para home, arquivo, temas, busca, RSS e sitemap."
          />
          <RadioRow
            name="ordem"
            value="asc"
            checked={s.ordem === "asc"}
            onChange={(v) => setS({ ...s, ordem: v as any })}
            label="Mais antigas primeiro"
          />
        </div>
      </Section>

      {/* Manchete (post fixo opcional) */}
      <MancheteBlock
        settings={s}
        onChange={(m) => setS({ ...s, manchete: m })}
      />

      {/* Carrossel da manchete */}
      <Section
        title="Carrossel da manchete"
        onReset={() => setS({ ...s, carrossel: CARROSSEL_PADRAO })}
      >
        <CarrosselEditor
          value={s.carrossel}
          temFixa={s.manchete.modo === "fixa" && !!s.manchete.post_id}
          onChange={(c) => setS({ ...s, carrossel: c })}
        />
      </Section>

      {/* Quantidades */}
      <Section
        title="Quantidades"
        onReset={() => setS({ ...s, quantidades: HOME_SETTINGS_PADRAO.quantidades })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Grade da home" value={s.quantidades.home_grade} min={3} max={48} def={12}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, home_grade: v } })} />
          <NumField label='Coluna "Leia agora"' value={s.quantidades.leia_agora} min={1} max={20} def={5}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, leia_agora: v } })} />
          <NumField label="Por página no arquivo" value={s.quantidades.arquivo} min={6} max={48} def={12}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, arquivo: v } })} />
          <NumField label="Por página nos temas" value={s.quantidades.tema} min={6} max={48} def={12}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, tema: v } })} />
          <NumField label='"Leia também" da matéria' value={s.quantidades.leia_tambem} min={1} max={12} def={3}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, leia_tambem: v } })} />
          <NumField label='Faixa "Não perca" (quantidade)' value={s.quantidades.nao_perca} min={1} max={20} def={6}
            onChange={(v) => setS({ ...s, quantidades: { ...s.quantidades, nao_perca: v } })} />
        </div>
      </Section>

      {/* Letreiro (faixa "Não perca") */}
      <Section
        title='Letreiro (faixa "NÃO PERCA")'
        onReset={() => setS({ ...s, letreiro: LETREIRO_PADRAO, nao_perca: HOME_SETTINGS_PADRAO.nao_perca })}
      >
        <LetreiroEditor
          value={s.letreiro}
          onChange={(l) => setS({ ...s, letreiro: l, nao_perca: { ativo: l.ativo, modo: l.origem } })}
        />
      </Section>

      {/* Carrossel de logos dos times da NHL */}
      <Section
        title="Carrossel de logos dos times (NHL)"
        onReset={() => setS({ ...s, times: TIMES_CARROSSEL_PADRAO })}
      >
        <TimesEditor value={s.times} onChange={(t) => setS({ ...s, times: t })} />
      </Section>




      {msg && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <span className="text-primary">✓ {msg}</span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
            Ver a home em nova aba →
          </a>
        </div>
      )}

      <button onClick={saveAll} className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90">
        Salvar
      </button>
    </div>
  );
}

/* ============================================================
 * Bloco da manchete com busca por título
 * ============================================================ */
function MancheteBlock({
  settings,
  onChange,
}: {
  settings: HomeSettings;
  onChange: (m: HomeSettings["manchete"]) => void;
}) {
  const m = settings.manchete;
  const search = useServerFn(searchAdminPostsByTitle);
  const getOne = useServerFn(getAdminPostSimple);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fixado, setFixado] = useState<any>(null);

  // Carrega dados do post fixado
  useEffect(() => {
    if (m.modo === "fixa" && m.post_id) {
      getOne({ data: { id: m.post_id } }).then((p) => setFixado(p)).catch(() => setFixado(null));
    } else {
      setFixado(null);
    }
  }, [m.modo, m.post_id, getOne]);

  const diasFixada = useMemo(() => {
    if (!m.fixada_em) return null;
    const ms = Date.now() - new Date(m.fixada_em).getTime();
    return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
  }, [m.fixada_em]);

  const doSearch = async (q: string) => {
    setBuscando(true);
    try {
      const items = await search({ data: { q } });
      setResultados(items);
    } finally {
      setBuscando(false);
    }
  };

  const escolher = (post: any) => {
    onChange({ modo: "fixa", post_id: post.id, fixada_em: new Date().toISOString() });
    setResultados([]);
    setTermo("");
    setFixado(post);
  };

  const soltar = () => {
    onChange({ modo: "auto", post_id: null, fixada_em: null });
    setFixado(null);
  };

  return (
    <Section
      title="Manchete da home"
      onReset={() => {
        onChange(HOME_SETTINGS_PADRAO.manchete);
        setFixado(null);
      }}
    >
      <div className="space-y-2">
        <RadioRow
          name="manchete"
          value="auto"
          checked={m.modo === "auto"}
          onChange={() => onChange({ modo: "auto", post_id: null, fixada_em: null })}
          label="Automática — sempre a matéria mais recente"
          hint="Padrão. A manchete acompanha a data de publicação."
        />
        <RadioRow
          name="manchete"
          value="fixa"
          checked={m.modo === "fixa"}
          onChange={() =>
            onChange({ modo: "fixa", post_id: m.post_id, fixada_em: m.fixada_em ?? new Date().toISOString() })
          }
          label="Fixa — eu escolho"
        />
      </div>

      {m.modo === "fixa" && (
        <div className="mt-4 rounded-md border border-border bg-background/50 p-4">
          {fixado ? (
            <div className="flex items-start gap-4">
              {fixado.imagem_capa && (
                <img src={fixado.imagem_capa} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {formatDataBR(fixado.publicado_em)}
                </div>
                <div className="mt-1 font-semibold text-foreground">{fixado.titulo}</div>
                {diasFixada !== null && (
                  <div
                    className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                      diasFixada > 7
                        ? "bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-500/50"
                        : "text-muted-foreground"
                    }`}
                  >
                    Fixada há {diasFixada} dia{diasFixada === 1 ? "" : "s"}
                    {diasFixada > 7 && " — considere atualizar"}
                  </div>
                )}
              </div>
              <button
                onClick={soltar}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-semibold uppercase hover:border-destructive hover:text-destructive"
              >
                Soltar manchete
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Buscar matéria por título
              </label>
              <div className="flex gap-2">
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(termo); } }}
                  placeholder="Digite parte do título…"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => doSearch(termo)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90"
                >
                  Buscar
                </button>
              </div>
              {buscando && <p className="mt-3 text-sm text-muted-foreground">Buscando…</p>}
              {!buscando && resultados.length > 0 && (
                <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
                  {resultados.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => escolher(p)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                      >
                        {p.imagem_capa ? (
                          <img src={p.imagem_capa} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-16 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{p.titulo}</div>
                          <div className="text-xs text-muted-foreground">{formatDataBR(p.publicado_em)}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!buscando && termo && resultados.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum resultado.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/* ============================================================
 * Componentes utilitários
 * ============================================================ */
function Section({
  title,
  children,
  onReset,
}: {
  title: string;
  children: React.ReactNode;
  onReset?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h4l-title text-lg text-foreground">{title}</h2>
        {onReset && (
          <button
            onClick={onReset}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            Restaurar padrões
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RadioRow({
  name, value, checked, onChange, label, hint,
}: { name: string; value: string; checked: boolean; onChange: (v: string) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1"
      />
      <span>
        <span className="text-foreground">{label}</span>
        {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function NumField({
  label, value, onChange, min, max, def,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; def: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">Mín. {min} · Máx. {max} · Padrão {def}</p>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input value={value ?? ""} onChange={(e)=>onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
    </div>
  );
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <textarea value={value ?? ""} rows={3} onChange={(e)=>onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
    </div>
  );
}

function LetreiroEditor({
  value,
  onChange,
}: {
  value: import("@/lib/posts.functions").LetreiroSettings;
  onChange: (v: import("@/lib/posts.functions").LetreiroSettings) => void;
}) {
  const l = value;
  const set = (patch: Partial<typeof l>) => onChange({ ...l, ...patch });
  const horizontal = l.direcao === "rtl" || l.direcao === "ltr";
  const previewItems = [
    { id: "p1", titulo: "Manchete de exemplo 1 para pré-visualização", slug: "#" },
    { id: "p2", titulo: "Segunda manchete rolando na fita vermelha", slug: "#" },
    { id: "p3", titulo: "E uma terceira só pra fechar o loop", slug: "#" },
  ];

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={l.ativo} onChange={(e) => set({ ativo: e.target.checked })} />
        <span>Mostrar o letreiro no topo da home</span>
      </label>

      <div className={l.ativo ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rótulo da etiqueta</label>
            <input
              value={l.rotulo}
              maxLength={40}
              onChange={(e) => set({ rotulo: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Padrão: NÃO PERCA</p>
          </div>
          <NumField label="Quantas manchetes" value={l.quantidade} min={3} max={15} def={5} onChange={(v) => set({ quantidade: v })} />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Origem das manchetes</div>
          <div className="space-y-1">
            <RadioRow name="lo" value="recentes" checked={l.origem === "recentes"} onChange={(v) => set({ origem: v as any })} label="As mais recentes" />
            <RadioRow name="lo" value="manual" checked={l.origem === "manual"} onChange={(v) => set({ origem: v as any })} label='Só as marcadas manualmente (campo "Não perca" na matéria)' />
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direção</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {([
              { v: "rtl", l: "→ para ←" },
              { v: "ltr", l: "← para →" },
              { v: "up", l: "↑ (baixo→cima)" },
              { v: "down", l: "↓ (cima→baixo)" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => set({ direcao: o.v as LetreiroDirecao })}
                className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  l.direcao === o.v ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <NumField
          label={horizontal ? "Segundos por volta" : "Segundos por manchete"}
          value={l.velocidade}
          min={3}
          max={60}
          def={horizontal ? 30 : 5}
          onChange={(v) => set({ velocidade: v })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <NumField
            label={`Altura da faixa (${l.alturaPx}px)`}
            value={l.alturaPx} min={24} max={80} def={36}
            onChange={(v) => set({ alturaPx: v })}
          />
          <NumField
            label={`Fonte dos títulos (${l.fonteTitulosPx}px)`}
            value={l.fonteTitulosPx} min={11} max={22} def={14}
            onChange={(v) => set({ fonteTitulosPx: v })}
          />
          <NumField
            label={`Fonte do rótulo (${l.rotuloTamanhoPx}px)`}
            value={l.rotuloTamanhoPx} min={10} max={18} def={12}
            onChange={(v) => set({ rotuloTamanhoPx: v })}
          />
        </div>
      </div>

      {/* Pré-visualização ao vivo */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</div>
        <div className="overflow-hidden rounded-md border border-border">
          <Letreiro items={previewItems} settings={l} standalone />
        </div>
      </div>
    </div>
  );
}

function CarrosselEditor({
  value,
  temFixa,
  onChange,
}: {
  value: CarrosselSettings;
  temFixa: boolean;
  onChange: (v: CarrosselSettings) => void;
}) {
  const c = value;
  const set = (patch: Partial<CarrosselSettings>) => onChange({ ...c, ...patch });
  const estatico = c.quantidade <= 1;

  return (
    <div className="space-y-4">
      <NumField
        label="Quantas matérias entram no rodízio"
        value={c.quantidade}
        min={1}
        max={10}
        def={5}
        onChange={(v) => set({ quantidade: v })}
      />
      {estatico && (
        <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          Modo estático: só uma matéria aparece, sem rodízio automático.
        </p>
      )}

      <div className={estatico ? "space-y-4 opacity-50 pointer-events-none" : "space-y-4"}>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modo de transição</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
            {([
              { v: "rtl", l: "→ para ←" },
              { v: "ltr", l: "← para →" },
              { v: "up", l: "↑ (baixo→cima)" },
              { v: "down", l: "↓ (cima→baixo)" },
              { v: "fade", l: "sem movimento" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => set({ transicao: o.v as TransicaoManchete })}
                className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  c.transicao === o.v ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label="Segundos parada em cada manchete"
            value={c.intervalo}
            min={3}
            max={30}
            def={7}
            onChange={(v) => set({ intervalo: v })}
          />
          <NumField
            label="Duração da transição (ms)"
            value={c.duracaoMs}
            min={200}
            max={1500}
            def={600}
            onChange={(v) => set({ duracaoMs: v })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            label="Título (mobile) px"
            value={c.tituloPx}
            min={16}
            max={48}
            def={20}
            onChange={(v) => set({ tituloPx: v })}
          />
          <NumField
            label="Título (desktop) px"
            value={c.tituloPxLg}
            min={20}
            max={72}
            def={30}
            onChange={(v) => set({ tituloPxLg: v })}
          />
          <NumField
            label="Resumo px"
            value={c.resumoPx}
            min={12}
            max={24}
            def={16}
            onChange={(v) => set({ resumoPx: v })}
          />
        </div>

        {/* Prévia ao vivo */}
        <div className="rounded-md border border-border bg-background/60 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prévia dos títulos
          </div>
          <div className="rounded-md bg-muted/40 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                Exemplo
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Hoje
              </span>
            </div>
            <h1
              className="h4l-title leading-tight text-foreground"
              style={{
                fontSize: `clamp(${c.tituloPx}px, ${c.tituloPx + (c.tituloPxLg - c.tituloPx) * 0.5}px, ${c.tituloPxLg}px)`,
              }}
            >
              Título da matéria em destaque no carrossel
            </h1>
            <p
              className="mt-2 line-clamp-2 max-w-2xl text-muted-foreground"
              style={{ fontSize: `${c.resumoPx}px` }}
            >
              Resumo curto que aparece abaixo do título — ajuste os controles acima e veja a prévia atualizar em tempo real.
            </p>
          </div>
        </div>
      </div>

      {temFixa && (
        <div className="rounded-md border border-border bg-background/50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manchete fixa</div>
          <div className="space-y-2">
            <RadioRow
              name="fixadaComRodizio"
              value="sim"
              checked={c.fixadaComRodizio}
              onChange={() => set({ fixadaComRodizio: true })}
              label="Fixada participa do rodízio"
              hint="Ela é sempre o primeiro slide, seguida das mais recentes."
            />
            <RadioRow
              name="fixadaComRodizio"
              value="nao"
              checked={!c.fixadaComRodizio}
              onChange={() => set({ fixadaComRodizio: false })}
              label="Fixada fica sozinha, sem rodízio"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * ABA 3 — Aparência (fundo de arena)
 * ============================================================ */
import { supabase as _supabaseAparencia } from "@/integrations/supabase/client";
import { criarUploadUrl as _criarUploadUrlAparencia } from "@/lib/admin.functions";
import {
  APARENCIA_PADRAO,
  ARENA_PADRAO,
  FundoArenaPreview,
  normalizeAparencia,
  type AparenciaConfig,
} from "@/components/site/FundoArena";

function AparenciaTab() {
  const qc = useQueryClient();
  const save = useServerFn(saveConfig);
  const uploadFn = useServerFn(_criarUploadUrlAparencia);
  const { data, isLoading } = useQuery({ queryKey: ["admin-config"], queryFn: () => listConfig() });

  const [s, setS] = useState<AparenciaConfig>(APARENCIA_PADRAO);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState("");

  useEffect(() => {
    if (!data) return;
    setS(normalizeAparencia(data.aparencia));
  }, [data]);

  const doSave = async (patch?: Partial<AparenciaConfig>) => {
    const next = { ...s, ...(patch ?? {}) };
    setS(next);
    setMsg("");
    await save({ data: { chave: "aparencia", valor: next } });
    qc.invalidateQueries({ queryKey: ["admin-config"] });
    qc.invalidateQueries({ queryKey: ["site-config"] });
    qc.invalidateQueries({ queryKey: ["home"] });
    setMsg("Aparência salva.");
  };

  const onUploadFundo = async (file: File) => {
    setUploading(true);
    setUploadInfo("");
    try {
      const { optimizeImage, renameFor, formatBytes } = await import("@/lib/image-optim");
      const r = await optimizeImage(file, { maxWidth: 2048, variantWidths: [1280, 1920] });
      // Upload principal (2048) + variantes (1280/1920). Se caiu no fallback, sobe apenas a original 3x.
      const base = file.name.replace(/\.[a-z0-9]+$/i, "");
      const uploads: Array<{ width: number; blob: Blob; url: string }> = [];

      const mainName = renameFor(file.name, r.main.ext, `${r.main.width || 2048}`);
      const mainUp = await uploadFn({ data: { nomeArquivo: mainName } });
      const { error: eMain } = await _supabaseAparencia.storage.from("midia").upload(mainUp.key, r.main.blob, {
        upsert: false, contentType: r.main.blob.type || undefined,
      });
      if (eMain) throw eMain;
      uploads.push({ width: r.main.width || 2048, blob: r.main.blob, url: mainUp.publicUrl });

      for (const v of r.variants) {
        const vn = renameFor(file.name, v.ext, `${v.width}`);
        const vu = await uploadFn({ data: { nomeArquivo: vn } });
        const { error: eV } = await _supabaseAparencia.storage.from("midia").upload(vu.key, v.blob, {
          upsert: false, contentType: v.blob.type || undefined,
        });
        if (eV) throw eV;
        uploads.push({ width: v.width, blob: v.blob, url: vu.publicUrl });
      }

      // Mapa por largura, com fallback se alguma faltar (ex.: original menor que 1280).
      const byWidth = new Map(uploads.map((u) => [u.width, u.url]));
      const pick = (w: number) => {
        if (byWidth.has(w)) return byWidth.get(w)!;
        // pega a maior disponível ≤ w, senão a menor > w
        const sorted = [...byWidth.entries()].sort((a, b) => a[0] - b[0]);
        const le = sorted.filter(([k]) => k <= w).pop();
        return (le ?? sorted[sorted.length - 1])[1];
      };
      const atual = { url_1280: pick(1280), url_1920: pick(1920), url_2048: pick(2048) };
      const galeria = [{ label: base.slice(0, 60) || "Fundo", ...atual }, ...s.galeria].slice(0, 20);
      const totalOtim = uploads.reduce((a, b) => a + b.blob.size, 0);
      setUploadInfo(`${formatBytes(r.originalSize)} → ${formatBytes(totalOtim)} (${uploads.length} arquivo${uploads.length > 1 ? "s" : ""})${r.usedOriginal ? " — original mantido" : ""}`);
      await doSave({ atual, galeria, ativo: true });
    } catch (e: any) {
      alert("Erro no upload: " + (e?.message ?? "desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  const legibilidadeBaixa = s.escurecimento < 30;

  return (
    <div className="space-y-6">
      <Section title="Fundo do site" onReset={() => doSave(APARENCIA_PADRAO)}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.ativo} onChange={(e) => setS({ ...s, ativo: e.target.checked })} />
          Fundo ativo
        </label>

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prévia ao vivo</div>
          <FundoArenaPreview aparencia={s} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumField
            label={`Escurecimento (${s.escurecimento}%)`}
            value={s.escurecimento} min={0} max={90} def={55}
            onChange={(v) => setS({ ...s, escurecimento: v })}
          />
          <NumField
            label={`Desfoque (${s.desfoque}px)`}
            value={s.desfoque} min={0} max={20} def={0}
            onChange={(v) => setS({ ...s, desfoque: v })}
          />
        </div>
        {legibilidadeBaixa && (
          <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            Escurecimento abaixo de 30%: o texto pode ficar ilegível sobre a imagem.
          </p>
        )}

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posição da imagem</div>
          <div className="grid grid-cols-3 gap-1">
            {(["top", "center", "bottom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setS({ ...s, posicao: p })}
                className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  s.posicao === p ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"
                }`}
              >
                {p === "top" ? "Topo" : p === "center" ? "Centro" : "Base"}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.mostrar_celular} onChange={(e) => setS({ ...s, mostrar_celular: e.target.checked })} />
          Mostrar no celular (padrão: desativado, para economizar dados)
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => doSave()}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary/90"
          >
            Salvar aparência
          </button>
          <button
            onClick={() => doSave({ atual: null })}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold uppercase text-foreground hover:border-primary hover:text-primary"
          >
            Restaurar fundo padrão (arena)
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
      </Section>

      <Section title="Trocar imagem de fundo">
        <p className="text-sm text-muted-foreground">
          A imagem passa por otimização automática no seu navegador: redimensionamento (2048/1920/1280 px), conversão para WebP,
          remoção de metadados EXIF e correção de orientação. Nada é enviado sem antes ser processado.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
          {uploading ? "Enviando…" : "Escolher imagem"}
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadFundo(f); e.currentTarget.value = ""; } }}
          />
        </label>
        {uploadInfo && <p className="mt-2 text-xs text-primary">Otimização: {uploadInfo}</p>}
      </Section>

      <Section title="Galeria de fundos enviados">
        {s.galeria.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fundo enviado ainda. O fundo padrão da arena continua ativo.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <button
              onClick={() => doSave({ atual: null })}
              className={`overflow-hidden rounded-md border-2 text-left ${s.atual === null ? "border-primary" : "border-border hover:border-primary/60"}`}
            >
              <img src={ARENA_PADRAO.url_1280} alt="" className="aspect-video w-full object-cover" />
              <div className="p-2 text-xs">Padrão — Arena</div>
            </button>
            {s.galeria.map((g, i) => {
              const ativo = s.atual?.url_1280 === g.url_1280;
              return (
                <div key={i} className={`overflow-hidden rounded-md border-2 ${ativo ? "border-primary" : "border-border"}`}>
                  <button onClick={() => doSave({ atual: { url_1280: g.url_1280, url_1920: g.url_1920, url_2048: g.url_2048 } })} className="block w-full text-left">
                    <img src={g.url_1280} alt={g.label} className="aspect-video w-full object-cover" />
                    <div className="p-2 text-xs">{g.label}</div>
                  </button>
                  <button
                    onClick={() => {
                      const galeria = s.galeria.filter((_, j) => j !== i);
                      const atual = ativo ? null : s.atual;
                      doSave({ galeria, atual });
                    }}
                    className="w-full border-t border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive-foreground"
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
