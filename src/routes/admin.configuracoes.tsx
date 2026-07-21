import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listConfig, saveConfig } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
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
    setHfc({ ...hfc, ...(data.hockey_fights_cancer ?? {}) });
    setRodape({ ...rodape, ...(data.rodape ?? {}) });
    setContato({ ...contato, ...(data.contato ?? {}) });
    setRedes({ ...redes, ...(data.redes_sociais ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div>
      <h1 className="h4l-title text-3xl text-foreground md:text-4xl">Configurações</h1>
      <p className="text-sm text-muted-foreground">Textos, contato e conteúdo dinâmico do site.</p>

      <div className="mt-6 space-y-6">
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="h4l-title text-lg text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
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
