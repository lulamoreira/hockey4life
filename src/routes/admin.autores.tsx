import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAutores, getAutor, saveAutor, deleteAutor, criarUploadUrl } from "@/lib/admin.functions";
import { slugify } from "@/lib/slugify";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/autores")({
  head: () => ({ meta: [{ title: "Autores — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AutoresPage,
});

function AutoresPage() {
  const [editId, setEditId] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const listaQ = useQuery({ queryKey: ["admin-autores"], queryFn: () => listAutores() });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Autores</h1>
        <button
          onClick={() => { setNovo(true); setEditId(null); }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground"
        >
          + Novo autor
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-card">
          {listaQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
          {(listaQ.data ?? []).map((a: any) => (
            <button
              key={a.id}
              onClick={() => { setEditId(a.id); setNovo(false); }}
              className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted ${editId === a.id ? "bg-muted" : ""}`}
            >
              {a.foto_url ? (
                <img src={a.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {a.nome.charAt(0)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{a.nome}</div>
                <div className="truncate text-xs text-muted-foreground">/{a.slug}</div>
              </div>
              <Link
                to="/autor/$slug"
                params={{ slug: a.slug }}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline"
              >
                ver
              </Link>
            </button>
          ))}
          {(listaQ.data ?? []).length === 0 && !listaQ.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum autor cadastrado.</p>
          )}
        </div>

        <div>
          {novo && <AutorForm key="novo" onSaved={() => { setNovo(false); listaQ.refetch(); }} onCancel={() => setNovo(false)} />}
          {editId && !novo && <AutorForm key={editId} id={editId} onSaved={() => listaQ.refetch()} onDeleted={() => { setEditId(null); listaQ.refetch(); }} onCancel={() => setEditId(null)} />}
          {!editId && !novo && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Selecione um autor à esquerda ou crie um novo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type TimelineItem = { ano: string; texto: string };

function AutorForm({ id, onSaved, onDeleted, onCancel }: { id?: string; onSaved: () => void; onDeleted?: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const isNew = !id;
  const save = useServerFn(saveAutor);
  const remove = useServerFn(deleteAutor);
  const uploadFn = useServerFn(criarUploadUrl);

  const autorQ = useQuery({ queryKey: ["admin-autor", id], queryFn: () => getAutor({ data: { id: id! } }), enabled: !isNew });

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [cargo, setCargo] = useState("");
  const [formacao, setFormacao] = useState("");
  const [competencias, setCompetencias] = useState("");
  const [bioCurta, setBioCurta] = useState("");
  const [bioMedia, setBioMedia] = useState("");
  const [bioLonga, setBioLonga] = useState("");
  const [foto, setFoto] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [site, setSite] = useState("");
  const [email, setEmail] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [linhaDoTempo, setLinhaDoTempo] = useState<TimelineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingGaleria, setUploadingGaleria] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (autorQ.data) {
      const a: any = autorQ.data;
      setNome(a.nome); setSlug(a.slug);
      setCargo(a.cargo ?? ""); setFormacao(a.formacao ?? ""); setCompetencias(a.competencias ?? "");
      setBioCurta(a.bio_curta ?? ""); setBioMedia(a.bio_media ?? ""); setBioLonga(a.bio_longa ?? a.bio ?? "");
      setFoto(a.foto_url ?? "");
      setLinkedin(a.linkedin_url ?? "");
      const outros = a.outros_links ?? {};
      const links = a.links ?? {};
      setTwitter(outros.twitter ?? links.twitter ?? "");
      setInstagram(outros.instagram ?? links.instagram ?? "");
      setSite(outros.site ?? links.site ?? "");
      setEmail(outros.email ?? links.email ?? "");
      setFotos(Array.isArray(a.fotos) ? a.fotos : []);
      setLinhaDoTempo(Array.isArray(a.linha_do_tempo) ? a.linha_do_tempo : []);
    } else if (isNew) {
      setNome(""); setSlug(""); setCargo(""); setFormacao(""); setCompetencias("");
      setBioCurta(""); setBioMedia(""); setBioLonga(""); setFoto("");
      setLinkedin(""); setTwitter(""); setInstagram(""); setSite(""); setEmail("");
      setFotos([]); setLinhaDoTempo([]);
    }
  }, [autorQ.data, isNew]);

  const uploadOne = async (file: File, maxWidth: number): Promise<string> => {
    const { optimizeImage, renameFor } = await import("@/lib/image-optim");
    const r = await optimizeImage(file, { maxWidth });
    const outName = renameFor(file.name, r.main.ext);
    const { key, publicUrl } = await uploadFn({ data: { nomeArquivo: outName } });
    const { error } = await supabase.storage.from("midia").upload(key, r.main.blob, { upsert: false, contentType: r.main.blob.type || undefined });
    if (error) throw error;
    return publicUrl;
  };

  const onUploadFoto = async (file: File) => {
    setUploading(true);
    try { setFoto(await uploadOne(file, 600)); }
    catch (e: any) { alert("Erro no upload: " + (e?.message ?? "desconhecido")); }
    finally { setUploading(false); }
  };

  const onUploadGaleria = async (files: FileList) => {
    setUploadingGaleria(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadOne(f, 1600));
      setFotos((prev) => [...prev, ...urls].slice(0, 6));
    } catch (e: any) { alert("Erro no upload: " + (e?.message ?? "desconhecido")); }
    finally { setUploadingGaleria(false); }
  };

  const onSalvar = async () => {
    setSaving(true); setMsg("");
    try {
      const outros_links: Record<string, string> = {};
      if (twitter) outros_links.twitter = twitter;
      if (instagram) outros_links.instagram = instagram;
      if (site) outros_links.site = site;
      if (email) outros_links.email = email;
      const result = await save({
        data: {
          id: isNew ? undefined : id,
          nome, slug: slug || slugify(nome),
          bio: null,
          bio_curta: bioCurta || null,
          bio_media: bioMedia || null,
          bio_longa: bioLonga || null,
          cargo: cargo || null,
          formacao: formacao || null,
          competencias: competencias || null,
          linkedin_url: linkedin || null,
          foto_url: foto || null,
          links: outros_links,
          outros_links,
          fotos,
          linha_do_tempo: linhaDoTempo.filter((i) => i.ano.trim() || i.texto.trim()),
        },
      });
      qc.invalidateQueries({ queryKey: ["admin-autores"] });
      qc.invalidateQueries({ queryKey: ["admin-autor", result.id] });
      setMsg("Salvo com sucesso.");
      onSaved();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao salvar.");
    } finally { setSaving(false); }
  };

  const onExcluir = async () => {
    if (!id) return;
    if (!confirm("Excluir este autor? As matérias ficarão sem autor.")) return;
    await remove({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-autores"] });
    onDeleted?.();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="h4l-title mb-4 text-xl text-foreground">{isNew ? "Novo autor" : "Editar autor"}</h2>
      {msg && <p className="mb-2 text-xs text-primary">{msg}</p>}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input value={nome} onChange={(e) => { setNome(e.target.value); if (isNew) setSlug(slugify(e.target.value)); }} className={inputCls} />
          </Field>
          <Field label="Slug (URL)">
            <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className={inputCls} />
          </Field>
        </div>

        <Field label="Foto principal">
          {foto && <img src={foto} alt="" className="mb-2 h-24 w-24 rounded-full object-cover" />}
          <input value={foto} onChange={(e) => setFoto(e.target.value)} placeholder="URL da foto" className={inputCls} />
          <label className="mt-2 block cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
            {uploading ? "Enviando…" : "Ou envie um arquivo (otimizado)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFoto(f); }} />
          </label>
        </Field>

        <Field label="Bio curta (resumo, aparece no topo e na sidebar)">
          <textarea value={bioCurta} onChange={(e) => setBioCurta(e.target.value)} rows={2} maxLength={500} className={inputCls} />
          <div className="mt-1 text-[10px] text-muted-foreground">{bioCurta.length}/500</div>
        </Field>
        <Field label="Bio média (caixa no fim das matérias)">
          <textarea value={bioMedia} onChange={(e) => setBioMedia(e.target.value)} rows={3} maxLength={1500} className={inputCls} />
          <div className="mt-1 text-[10px] text-muted-foreground">{bioMedia.length}/1500</div>
        </Field>
        <Field label="Bio longa (página do autor)">
          <textarea value={bioLonga} onChange={(e) => setBioLonga(e.target.value)} rows={6} maxLength={8000} className={inputCls} />
          <div className="mt-1 text-[10px] text-muted-foreground">{bioLonga.length}/8000</div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="LinkedIn URL"><input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className={inputCls} /></Field>
          <Field label="Twitter/X URL"><input value={twitter} onChange={(e) => setTwitter(e.target.value)} className={inputCls} /></Field>
          <Field label="Instagram URL"><input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputCls} /></Field>
          <Field label="Site"><input value={site} onChange={(e) => setSite(e.target.value)} className={inputCls} /></Field>
          <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
        </div>

        <Field label={`Galeria (${fotos.length}/6)`}>
          {fotos.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {fotos.map((u, i) => (
                <div key={i} className="relative">
                  <img src={u} alt="" className="aspect-square w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground"
                    title="Remover"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {fotos.length < 6 && (
            <label className="block cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
              {uploadingGaleria ? "Enviando…" : "+ Adicionar fotos à galeria"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onUploadGaleria(e.target.files); }} />
            </label>
          )}
        </Field>

        <Field label="Linha do tempo">
          <div className="space-y-2">
            {linhaDoTempo.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  value={item.ano}
                  onChange={(e) => setLinhaDoTempo((prev) => prev.map((x, j) => j === i ? { ...x, ano: e.target.value } : x))}
                  placeholder="Ano"
                  className={`${inputCls} w-24 shrink-0`}
                />
                <input
                  value={item.texto}
                  onChange={(e) => setLinhaDoTempo((prev) => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                  placeholder="O que aconteceu"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setLinhaDoTempo((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded border border-destructive/60 px-2 py-2 text-xs text-destructive hover:bg-destructive/10"
                >Remover</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinhaDoTempo((prev) => [...prev, { ano: "", texto: "" }])}
              className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >+ Adicionar item</button>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={onSalvar} disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold uppercase text-foreground">
          Cancelar
        </button>
        {!isNew && (
          <button onClick={onExcluir}
            className="ml-auto rounded-md border border-destructive/60 px-4 py-2 text-sm font-semibold uppercase text-destructive hover:bg-destructive/10">
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
