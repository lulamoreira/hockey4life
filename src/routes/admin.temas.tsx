import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTemas, saveTema, deleteTema } from "@/lib/admin.functions";
import { slugify } from "@/lib/slugify";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/temas")({
  component: TemasPage,
});

function TemasPage() {
  const qc = useQueryClient();
  const save = useServerFn(saveTema);
  const del = useServerFn(deleteTema);
  const { data } = useQuery({ queryKey: ["admin-temas"], queryFn: () => listTemas() });
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"time" | "assunto">("time");
  const [destaque, setDestaque] = useState(false);
  const [ordem, setOrdem] = useState(0);

  const add = async () => {
    if (!nome.trim()) return;
    await save({ data: { nome, slug: slugify(nome), tipo, destaque_menu: destaque, ordem } });
    setNome(""); setOrdem(0); setDestaque(false);
    qc.invalidateQueries({ queryKey: ["admin-temas"] });
  };

  const onDel = async (id: string) => {
    if (!confirm("Excluir tema? Matérias vinculadas perdem a associação.")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-temas"] });
  };

  return (
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Temas</h1>
      <p className="text-sm text-muted-foreground">Times e assuntos usados para categorizar matérias.</p>

      <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_140px_140px_80px_auto]">
        <input value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Nome do tema"
          className="rounded-md border border-border bg-background px-3 py-2" />
        <select value={tipo} onChange={(e)=>setTipo(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2">
          <option value="time">Time</option><option value="assunto">Assunto</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={destaque} onChange={(e)=>setDestaque(e.target.checked)} /> Menu
        </label>
        <input type="number" value={ordem} onChange={(e)=>setOrdem(+e.target.value)} placeholder="Ordem"
          className="rounded-md border border-border bg-background px-3 py-2" />
        <button onClick={add} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground">
          <Plus className="h-4 w-4"/> Adicionar
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Menu</th>
              <th className="px-4 py-3 text-left">Ordem</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((t: any) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">/{t.tipo}/{t.slug}</td>
                <td className="px-4 py-3">{t.tipo}</td>
                <td className="px-4 py-3">{t.destaque_menu ? "✓" : "—"}</td>
                <td className="px-4 py-3">{t.ordem}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={()=>onDel(t.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
                    <Trash2 className="h-3.5 w-3.5"/> Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
