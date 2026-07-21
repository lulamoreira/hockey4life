import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { listArchive, listTemasParaFiltro, getSiteConfig, getArchiveNav } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PostCard } from "@/components/site/PostCard";
import { X, Filter } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  temas: z.union([z.array(z.string()), z.string()]).optional().transform<string[]>((v) => {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }),
  ano: z.coerce.number().int().optional().nullable(),
  mes: z.coerce.number().int().min(1).max(12).optional().nullable(),
  ordem: z.enum(["desc", "asc", "rel"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).default(1),
});

type ArquivoSearch = {
  q: string;
  temas: string[];
  ano?: number | null;
  mes?: number | null;
  ordem: "desc" | "asc" | "rel";
  page: number;
};

const q = (s: ArquivoSearch) =>
  queryOptions({
    queryKey: ["arquivo", s],
    queryFn: () => listArchive({ data: {
      q: s.q ?? "",
      temas: s.temas ?? [],
      ano: s.ano ?? undefined,
      mes: s.mes ?? undefined,
      ordem: s.ordem,
      page: s.page,
    } }),
    staleTime: 60_000,
  });
const cfg = () => queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });
const temasQ = () => queryOptions({ queryKey: ["temas-filtro"], queryFn: () => listTemasParaFiltro(), staleTime: 120_000 });
const navQ = () => queryOptions({ queryKey: ["arquivo-nav"], queryFn: () => getArchiveNav(), staleTime: 120_000 });

export const Route = createFileRoute("/arquivo")({
  validateSearch: (v): ArquivoSearch => searchSchema.parse(v ?? {}) as ArquivoSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(q(deps.search)),
      context.queryClient.ensureQueryData(cfg()),
      context.queryClient.ensureQueryData(temasQ()),
      context.queryClient.ensureQueryData(navQ()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Arquivo — Hockey4Life" },
      { name: "description", content: "Todas as matérias do Hockey4Life. Filtre por time, assunto, ano e mês." },
      { property: "og:title", content: "Arquivo — Hockey4Life" },
      { property: "og:description", content: "Todas as matérias do Hockey4Life. Filtre por time, assunto, ano e mês." },
      { property: "og:url", content: "/arquivo" },
    ],
    links: [{ rel: "canonical", href: "/arquivo" }],
  }),
  component: ArquivoPage,
});

const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function ArquivoPage() {
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(q(search));
  const { data: site } = useSuspenseQuery(cfg());
  const { data: todosTemas } = useSuspenseQuery(temasQ());
  const { data: nav } = useSuspenseQuery(navQ());
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const update = (patch: Partial<ArquivoSearch>) => {
    navigate({ to: "/arquivo", search: { ...search, ...patch, page: 1 } as any });
  };
  const goPage = (p: number) => navigate({ to: "/arquivo", search: { ...search, page: p } as any });

  const temasArr: string[] = (search.temas as string[] | undefined) ?? [];
  const temasSel = new Set<string>(temasArr);
  const times = (todosTemas ?? []).filter((t) => t.tipo === "time");
  const assuntos = (todosTemas ?? []).filter((t) => t.tipo === "assunto");
  const temasById = new Map(todosTemas.map((t) => [t.id, t]));

  const anos = Array.from(new Set(nav.map((r) => r.ano))).sort((a, b) => b - a);

  const chips: Array<{ label: string; onRemove: () => void }> = [];
  if (search.q) chips.push({ label: `“${search.q}”`, onRemove: () => update({ q: "" }) });
  temasArr.forEach((id: string) => {
    const t = temasById.get(id);
    if (t) chips.push({ label: t.nome, onRemove: () => update({ temas: temasArr.filter((x: string) => x !== id) }) });
  });
  if (search.ano) chips.push({ label: `${search.ano}${search.mes ? `/${String(search.mes).padStart(2, "0")}` : ""}`, onRemove: () => update({ ano: null, mes: null }) });

  const hasFiltros = chips.length > 0 || search.ordem !== "desc";
  const clearAll = () => navigate({ to: "/arquivo", search: { q: "", temas: [], ano: null, mes: null, ordem: "desc", page: 1 } as any });

  return (
    <SiteLayout config={site.config} temasMenu={site.temasMenu as any}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="h4l-title text-4xl text-foreground md:text-6xl">Arquivo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.total} matéria(s) — página {search.page} de {data.totalPages}
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold uppercase tracking-wider md:hidden"
          >
            <Filter className="h-4 w-4" /> Filtros
          </button>
        </div>

        {/* Chips ativos */}
        {hasFiltros && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((c, i) => (
              <button key={i} onClick={c.onRemove} className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">
                {c.label} <X className="h-3 w-3" />
              </button>
            ))}
            <button onClick={clearAll} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-destructive">
              Limpar tudo
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Filtros desktop */}
          <aside className="hidden lg:block">
            <FiltrosPanel
              search={search}
              times={times}
              assuntos={assuntos}
              anos={anos}
              nav={nav}
              temasSel={temasSel}
              update={update}
            />
          </aside>

          {/* Filtros drawer mobile */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
              <div className="absolute inset-0 bg-black/60" />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-5 shadow-2xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="h4l-title text-lg">Filtros</div>
                  <button onClick={() => setDrawerOpen(false)} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                <FiltrosPanel
                  search={search}
                  times={times}
                  assuntos={assuntos}
                  anos={anos}
                  nav={nav}
                  temasSel={temasSel}
                  update={update}
                />
              </div>
            </div>
          )}

          {/* Resultados */}
          <div>
            {data.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-muted-foreground">Nenhuma matéria encontrada com esses filtros.</p>
                <button onClick={clearAll} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground">
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )}

            {data.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button disabled={search.page <= 1} onClick={() => goPage(search.page - 1)} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-40">← Anterior</button>
                <span className="text-sm text-muted-foreground">Página {search.page} de {data.totalPages}</span>
                <button disabled={search.page >= data.totalPages} onClick={() => goPage(search.page + 1)} className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-40">Próxima →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

function FiltrosPanel({
  search, times, assuntos, anos, nav, temasSel, update,
}: {
  search: ArquivoSearch;
  times: Array<{ id: string; nome: string; total: number }>;
  assuntos: Array<{ id: string; nome: string; total: number }>;
  anos: number[];
  nav: Array<{ ano: number; mes: number; total: number }>;
  temasSel: Set<string>;
  update: (p: Partial<ArquivoSearch>) => void;
}) {
  const toggleTema = (id: string) => {
    const next = temasSel.has(id) ? (search.temas ?? []).filter((x) => x !== id) : [...(search.temas ?? []), id];
    update({ temas: next });
  };
  const mesesDoAno = search.ano ? nav.filter((r) => r.ano === search.ano) : [];

  return (
    <div className="space-y-6">
      {/* Ordenação */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Ordenar por</div>
        <div className="flex flex-wrap gap-1">
          {[
            { v: "desc", l: "Recentes" },
            { v: "asc", l: "Antigas" },
            ...(search.q ? [{ v: "rel", l: "Relevantes" }] : []),
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => update({ ordem: o.v as any })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                search.ordem === o.v ? "bg-primary text-primary-foreground" : "border border-border hover:border-primary"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Período */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Período</div>
        <select
          value={search.ano ?? ""}
          onChange={(e) => update({ ano: e.target.value ? Number(e.target.value) : null, mes: null })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {search.ano && (
          <select
            value={search.mes ?? ""}
            onChange={(e) => update({ mes: e.target.value ? Number(e.target.value) : null })}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os meses de {search.ano}</option>
            {mesesDoAno.map((r) => (
              <option key={r.mes} value={r.mes}>{MESES[r.mes]} ({r.total})</option>
            ))}
          </select>
        )}
      </div>

      {/* Times */}
      {times.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Times</div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-2">
            {times.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={temasSel.has(t.id)} onChange={() => toggleTema(t.id)} className="rounded" />
                <span className="flex-1 truncate">{t.nome}</span>
                <span className="text-xs text-muted-foreground">{t.total}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Assuntos */}
      {assuntos.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Assuntos</div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-2">
            {assuntos.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={temasSel.has(t.id)} onChange={() => toggleTema(t.id)} className="rounded" />
                <span className="flex-1 truncate">{t.nome}</span>
                <span className="text-xs text-muted-foreground">{t.total}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Link to="/temas" className="block text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
        Ver todos os temas →
      </Link>
    </div>
  );
}
