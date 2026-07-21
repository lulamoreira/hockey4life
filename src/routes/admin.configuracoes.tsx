import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listConfig, saveConfig, searchAdminPostsByTitle, getAdminPostSimple } from "@/lib/admin.functions";
import { HOME_SETTINGS_PADRAO, type HomeSettings } from "@/lib/posts.functions";
import { formatDataBR } from "@/lib/slugify";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

type Tab = "geral" | "home";

function ConfigPage() {
  const [tab, setTab] = useState<Tab>("geral");

  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Configurações</h1>
      <p className="text-sm text-muted-foreground">Textos do site e regras de ordenação da home.</p>

      <div className="mt-6 flex gap-1 border-b border-border">
        <TabBtn active={tab === "geral"} onClick={() => setTab("geral")}>Textos e contato</TabBtn>
        <TabBtn active={tab === "home"} onClick={() => setTab("home")}>Home e ordenação</TabBtn>
      </div>

      <div className="mt-6">
        {tab === "geral" ? <GeralTab /> : <HomeTab />}
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
      quantidades: { ...HOME_SETTINGS_PADRAO.quantidades, ...(raw.quantidades ?? {}) },
      nao_perca: { ...HOME_SETTINGS_PADRAO.nao_perca, ...(raw.nao_perca ?? {}) },
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

      {/* Manchete */}
      <MancheteBlock
        settings={s}
        onChange={(m) => setS({ ...s, manchete: m })}
      />

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

      {/* Não perca */}
      <Section
        title='Faixa "Não perca"'
        onReset={() => setS({ ...s, nao_perca: HOME_SETTINGS_PADRAO.nao_perca })}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.nao_perca.ativo}
            onChange={(e) => setS({ ...s, nao_perca: { ...s.nao_perca, ativo: e.target.checked } })}
          />
          <span>Mostrar a faixa vermelha no topo da home</span>
        </label>
        <div className={`mt-3 space-y-2 ${s.nao_perca.ativo ? "" : "opacity-50 pointer-events-none"}`}>
          <RadioRow
            name="np"
            value="recentes"
            checked={s.nao_perca.modo === "recentes"}
            onChange={(v) => setS({ ...s, nao_perca: { ...s.nao_perca, modo: v as any } })}
            label={`As ${s.quantidades.nao_perca} matérias mais recentes`}
          />
          <RadioRow
            name="np"
            value="manual"
            checked={s.nao_perca.modo === "manual"}
            onChange={(v) => setS({ ...s, nao_perca: { ...s.nao_perca, modo: v as any } })}
            label='Só as marcadas manualmente (campo "Não perca" na matéria)'
          />
        </div>
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
