import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAdminPost, listTemas, savePost, criarUploadUrl } from "@/lib/admin.functions";
import { slugify } from "@/lib/slugify";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

export const Route = createFileRoute("/admin/posts/$id")({
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(savePost);
  const uploadFn = useServerFn(criarUploadUrl);

  const postQ = useQuery({
    queryKey: ["admin-post", id],
    queryFn: () => getAdminPost({ data: { id } }),
    enabled: !isNew,
  });
  const temasQ = useQuery({ queryKey: ["admin-temas"], queryFn: () => listTemas() });

  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [resumo, setResumo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [imagemCapa, setImagemCapa] = useState("");
  const [creditoImagem, setCreditoImagem] = useState("");
  const [status, setStatus] = useState<"rascunho" | "publicado">("rascunho");
  const [destaque, setDestaque] = useState(false);
  const [naoPerca, setNaoPerca] = useState(false);
  const [publicadoEm, setPublicadoEm] = useState("");
  const [selTemas, setSelTemas] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isNew && postQ.data?.post) {
      const p = postQ.data.post;
      setTitulo(p.titulo); setSlug(p.slug);
      setResumo(p.resumo ?? ""); setConteudo(p.conteudo ?? "");
      setImagemCapa(p.imagem_capa ?? ""); setCreditoImagem(p.credito_imagem ?? "");
      setStatus(p.status); setDestaque(p.destaque); setNaoPerca(p.nao_perca);
      setPublicadoEm(p.publicado_em ? new Date(p.publicado_em).toISOString().slice(0, 16) : "");
      setSelTemas(new Set(postQ.data.temaIds));
    }
  }, [isNew, postQ.data]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const { key, publicUrl } = await uploadFn({ data: { nomeArquivo: file.name } });
      const { error } = await supabase.storage.from("midia").upload(key, file, { upsert: false });
      if (error) throw error;
      setImagemCapa(publicUrl);
    } catch (e: any) {
      alert("Erro no upload: " + (e?.message ?? "desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  const onSave = async (novoStatus?: "rascunho" | "publicado") => {
    setSaving(true); setMsg("");
    try {
      const finalStatus = novoStatus ?? status;
      const result = await save({
        data: {
          id: isNew ? undefined : id,
          titulo, slug: slug || slugify(titulo),
          resumo: resumo || null, conteudo: conteudo || null,
          imagem_capa: imagemCapa || null, credito_imagem: creditoImagem || null,
          status: finalStatus, destaque, nao_perca: naoPerca,
          publicado_em: publicadoEm ? new Date(publicadoEm).toISOString() : null,
          temaIds: Array.from(selTemas),
        },
      });
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-post", id] });
      setStatus(finalStatus);
      if (isNew) navigate({ to: "/admin/posts/$id", params: { id: result.id! } });
      setMsg("Salvo com sucesso.");
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao salvar.");
    } finally { setSaving(false); }
  };

  const temas = temasQ.data ?? [];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="h4l-title text-3xl text-foreground md:text-4xl">
            {isNew ? "Nova matéria" : "Editar matéria"}
          </h1>
          {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSave("rascunho")} disabled={saving}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold uppercase text-foreground disabled:opacity-50">
            Salvar rascunho
          </button>
          <button onClick={() => onSave("publicado")} disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-50">
            Publicar
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Field label="Título">
            <input value={titulo}
              onChange={(e) => { setTitulo(e.target.value); if (isNew) setSlug(slugify(e.target.value)); }}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-lg text-foreground focus:border-primary focus:outline-none" />
          </Field>
          <Field label="Slug (URL)">
            <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
          </Field>
          <Field label="Resumo">
            <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={3} maxLength={1000}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
          </Field>
          <Field label="Conteúdo (HTML)">
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={20}
              placeholder="<p>Escreva a matéria em HTML. Use &lt;h2&gt;, &lt;p&gt;, &lt;img&gt;, etc.</p>"
              className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
            <p className="mt-1 text-xs text-muted-foreground">
              Aceita HTML. As tags básicas (p, h2, h3, img, a, blockquote, ul, ol, iframe) já são estilizadas.
            </p>
          </Field>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h4l-title mb-3 text-sm">Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground">
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
            </select>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} /> Destaque principal
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={naoPerca} onChange={(e) => setNaoPerca(e.target.checked)} /> Não perca (faixa vermelha)
            </label>
            <div className="mt-3">
              <label className="text-xs uppercase text-muted-foreground">Publicação</label>
              <input type="datetime-local" value={publicadoEm} onChange={(e)=>setPublicadoEm(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h4l-title mb-3 text-sm">Imagem de capa</div>
            {imagemCapa && <img src={imagemCapa} alt="" className="mb-3 aspect-video w-full rounded object-cover" />}
            <input value={imagemCapa} onChange={(e)=>setImagemCapa(e.target.value)} placeholder="URL da imagem"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
            <label className="mt-2 block cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
              {uploading ? "Enviando…" : "Ou envie um arquivo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f) onUpload(f);}} />
            </label>
            <input value={creditoImagem} onChange={(e)=>setCreditoImagem(e.target.value)} placeholder="Crédito da imagem"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h4l-title mb-3 text-sm">Temas</div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {temas.map((t: any) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selTemas.has(t.id)}
                    onChange={(e) => {
                      const s = new Set(selTemas);
                      if (e.target.checked) s.add(t.id); else s.delete(t.id);
                      setSelTemas(s);
                    }} />
                  <span className="text-muted-foreground">{t.tipo === "time" ? "🏒" : "📌"}</span>
                  {t.nome}
                </label>
              ))}
              {temas.length === 0 && <p className="text-xs text-muted-foreground">Cadastre temas primeiro em Temas.</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
