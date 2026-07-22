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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
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

function AutorForm({ id, onSaved, onDeleted, onCancel }: { id?: string; onSaved: () => void; onDeleted?: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const isNew = !id;
  const save = useServerFn(saveAutor);
  const remove = useServerFn(deleteAutor);
  const uploadFn = useServerFn(criarUploadUrl);

  const autorQ = useQuery({ queryKey: ["admin-autor", id], queryFn: () => getAutor({ data: { id: id! } }), enabled: !isNew });

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [foto, setFoto] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [site, setSite] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (autorQ.data) {
      const a: any = autorQ.data;
      setNome(a.nome); setSlug(a.slug);
      setBio(a.bio ?? ""); setFoto(a.foto_url ?? "");
      const links = a.links ?? {};
      setTwitter(links.twitter ?? ""); setInstagram(links.instagram ?? "");
      setSite(links.site ?? ""); setEmail(links.email ?? "");
    } else if (isNew) {
      setNome(""); setSlug(""); setBio(""); setFoto("");
      setTwitter(""); setInstagram(""); setSite(""); setEmail("");
    }
  }, [autorQ.data, isNew]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const { optimizeImage, renameFor } = await import("@/lib/image-optim");
      const r = await optimizeImage(file, { maxWidth: 600 });
      const outName = renameFor(file.name, r.main.ext);
      const { key, publicUrl } = await uploadFn({ data: { nomeArquivo: outName } });
      const { error } = await supabase.storage.from("midia").upload(key, r.main.blob, { upsert: false, contentType: r.main.blob.type || undefined });
      if (error) throw error;
      setFoto(publicUrl);
    } catch (e: any) {
      alert("Erro no upload: " + (e?.message ?? "desconhecido"));
    } finally { setUploading(false); }
  };

  const onSalvar = async () => {
    setSaving(true); setMsg("");
    try {
      const links: Record<string, string> = {};
      if (twitter) links.twitter = twitter;
      if (instagram) links.instagram = instagram;
      if (site) links.site = site;
      if (email) links.email = email;
      const result = await save({
        data: {
          id: isNew ? undefined : id,
          nome, slug: slug || slugify(nome),
          bio: bio || null, foto_url: foto || null,
          links,
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
      <div className="space-y-3">
        <Field label="Nome">
          <input value={nome} onChange={(e) => { setNome(e.target.value); if (isNew) setSlug(slugify(e.target.value)); }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Slug (URL)">
          <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={4000}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Foto">
          {foto && <img src={foto} alt="" className="mb-2 h-20 w-20 rounded-full object-cover" />}
          <input value={foto} onChange={(e) => setFoto(e.target.value)} placeholder="URL da foto"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <label className="mt-2 block cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
            {uploading ? "Enviando…" : "Ou envie um arquivo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          </label>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Twitter/X URL"><input value={twitter} onChange={(e) => setTwitter(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></Field>
          <Field label="Instagram URL"><input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></Field>
          <Field label="Site"><input value={site} onChange={(e) => setSite(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></Field>
          <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></Field>
        </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
