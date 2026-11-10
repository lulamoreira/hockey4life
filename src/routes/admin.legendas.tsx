import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { gerarLegenda } from "@/lib/legenda.functions";

export const Route = createFileRoute("/admin/legendas")({
  head: () => ({ meta: [{ title: "Legendas para redes — Admin Hockey4Life" }, { name: "robots", content: "noindex" }] }),
  component: Legendas,
});

type Rede = "instagram" | "bluesky" | "facebook" | "x";

function Legendas() {
  const fn = useServerFn(gerarLegenda);
  const [texto, setTexto] = useState("");
  const [rede, setRede] = useState<Rede>("instagram");
  const [legenda, setLegenda] = useState("");
  const [copiado, setCopiado] = useState(false);
  const m = useMutation({
    mutationFn: () => fn({ data: { texto, rede } }),
    onSuccess: (r) => { if (r.ok) setLegenda(r.legenda); },
  });
  const erro = m.data && !m.data.ok ? m.data.erro : m.error ? "Não foi possível gerar a legenda. Confira se o texto tem pelo menos 50 caracteres." : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl uppercase">Legendas para redes</h1>
        <p className="text-sm text-muted-foreground">Cole o texto da matéria e receba uma legenda pronta para compartilhar.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Rede social">
        {(["instagram", "bluesky", "facebook", "x"] as Rede[]).map((r) => (
          <button key={r} role="radio" aria-checked={rede === r} onClick={() => setRede(r)} className={`rounded-md border px-3 py-1.5 text-sm capitalize ${rede === r ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{r === "x" ? "X" : r}</button>
        ))}
      </div>
      <textarea aria-label="Texto da matéria" value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} placeholder="Cole aqui o texto da matéria…" className="w-full rounded-md border border-border bg-card p-3 text-sm" />
      <button onClick={() => m.mutate()} disabled={m.isPending || texto.trim().length < 50} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        <Sparkles className="h-4 w-4" /> {m.isPending ? "Gerando…" : "Gerar legenda"}
      </button>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {legenda && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Legenda ({legenda.length} caracteres) — pode editar</span>
            <button onClick={async () => { await navigator.clipboard.writeText(legenda); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="inline-flex items-center gap-1 text-sm text-primary"><Copy className="h-4 w-4" />{copiado ? "Copiado!" : "Copiar"}</button>
          </div>
          <textarea aria-label="Legenda gerada" value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={8} className="w-full rounded-md border border-border bg-background p-3 text-sm" />
        </div>
      )}
    </div>
  );
}
