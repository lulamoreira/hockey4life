import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getSearchConsole, type LinhaGSC } from "@/lib/search-console.functions";

export const Route = createFileRoute("/admin/busca-google")({
  head: () => ({ meta: [{ title: "Busca no Google — Admin Hockey4Life" }, { name: "robots", content: "noindex" }] }),
  component: BuscaGoogle,
});

const CHAVE = "h4l-gsc-site";
const nf = new Intl.NumberFormat("pt-BR");

function BuscaGoogle() {
  const fn = useServerFn(getSearchConsole);
  const [site, setSite] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [dias, setDias] = useState(28);
  useEffect(() => { setSite(localStorage.getItem(CHAVE)); setPronto(true); }, []);
  const q = useQuery({
    queryKey: ["gsc", site, dias], enabled: pronto, staleTime: 60 * 60 * 1000,
    queryFn: () => fn({ data: { siteUrl: site, dias } }),
  });
  const escolher = (s: string) => { localStorage.setItem(CHAVE, s); setSite(s); };
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase">Busca no Google</h1>
          <p className="text-sm text-muted-foreground">Impressões, cliques, posição e buscas que trazem leitores (dados do Google Search Console).</p>
        </div>
        <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <option value={7}>Últimos 7 dias</option><option value={28}>Últimos 28 dias</option><option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {(q.isLoading || !pronto) && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
      {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
      {d?.status === "sem_propriedade" && <p className="text-muted-foreground">Nenhuma propriedade verificada do hockey4life.com.br na conta Google conectada.</p>}
      {d?.status === "erro" && <p className="text-destructive">{d.erro}</p>}
      {d && "candidatos" in d && d.candidatos && d.candidatos.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm">{d.status === "escolher" ? "Escolha qual propriedade acompanhar:" : "Propriedade:"}</p>
          <div className="flex flex-wrap gap-2">
            {d.candidatos.map((c) => (
              <button key={c} onClick={() => escolher(c)} className={`rounded-md border px-3 py-1.5 text-sm ${d.status === "ok" && d.siteUrl === c ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {d?.status === "ok" && (
        <>
          <p className="text-xs text-muted-foreground">Propriedade {d.siteUrl} · {d.inicio.split("-").reverse().join("/")} a {d.fim.split("-").reverse().join("/")}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card titulo="Cliques" valor={nf.format(d.totais.cliques)} />
            <Card titulo="Impressões" valor={nf.format(d.totais.impressoes)} />
            <Card titulo="CTR" valor={`${(d.totais.ctr * 100).toFixed(1).replace(".", ",")}%`} />
            <Card titulo="Posição média" valor={d.totais.posicao ? d.totais.posicao.toFixed(1).replace(".", ",") : "—"} />
          </div>
          <Grafico linhas={d.diario} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Tabela titulo="Buscas que trazem leitores" linhas={d.buscas} />
            <Tabela titulo="Matérias mais vistas no Google" linhas={d.paginas} pagina />
          </div>
        </>
      )}
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">{titulo}</div><div className="mt-1 font-display text-2xl">{valor}</div></div>;
}

function Grafico({ linhas }: { linhas: LinhaGSC[] }) {
  if (!linhas.length) return null;
  const max = Math.max(1, ...linhas.map((l) => l.impressoes));
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Impressões por dia</div>
      <div className="flex h-28 items-end gap-0.5">
        {linhas.map((l) => (
          <div key={l.chave} title={`${l.chave}: ${l.impressoes} impressões, ${l.cliques} cliques`} className="flex-1 rounded-t bg-primary/70" style={{ height: `${(l.impressoes / max) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function Tabela({ titulo, linhas, pagina }: { titulo: string; linhas: LinhaGSC[]; pagina?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold uppercase">{titulo}</div>
      {linhas.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Ainda sem dados no período.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left">{pagina ? "Página" : "Busca"}</th><th className="px-2 text-right">Cliques</th><th className="px-2 text-right">Impr.</th><th className="px-4 text-right">Pos.</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-t border-border">
                  <td className="max-w-[260px] truncate px-4 py-2" title={l.chave}>{pagina ? <a href={l.chave} target="_blank" rel="noreferrer" className="hover:text-primary">{l.chave.replace(/^https?:\/\/[^/]+/, "") || "/"}</a> : l.chave}</td>
                  <td className="px-2 text-right">{nf.format(l.cliques)}</td>
                  <td className="px-2 text-right">{nf.format(l.impressoes)}</td>
                  <td className="px-4 text-right">{l.posicao.toFixed(1).replace(".", ",")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
