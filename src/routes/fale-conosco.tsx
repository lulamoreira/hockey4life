import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { enviarContato, getSiteConfig } from "@/lib/posts.functions";
import { SiteLayout } from "@/components/site/SiteLayout";

const cfg = () =>
  queryOptions({ queryKey: ["site-config"], queryFn: () => getSiteConfig(), staleTime: 120_000 });

export const Route = createFileRoute("/fale-conosco")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cfg()),
  head: () => ({
    meta: [
      { title: "Fale conosco — Hockey4Life" },
      { name: "description", content: "Entre em contato com a redação do Hockey4Life." },
      { property: "og:title", content: "Fale conosco — Hockey4Life" },
      { property: "og:url", content: "/fale-conosco" },
    ],
    links: [{ rel: "canonical", href: "/fale-conosco" }],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const { data: site } = useSuspenseQuery(cfg());
  const send = useServerFn(enviarContato);
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [erro, setErro] = useState<string>("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending"); setErro("");
    try {
      await send({
        data: {
          nome: String(fd.get("nome") ?? ""),
          email: String(fd.get("email") ?? ""),
          assunto: String(fd.get("assunto") ?? ""),
          mensagem: String(fd.get("mensagem") ?? ""),
        },
      });
      setState("ok");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao enviar.");
      setState("err");
    }
  };

  return (
    <SiteLayout config={site.config} temasMenu={site.temasMenu as any}>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="h4l-title text-4xl text-foreground md:text-5xl">Fale conosco</h1>
        <p className="mt-2 text-muted-foreground">
          Tem uma história, sugestão ou correção? Escreva pra gente.
        </p>

        {state === "ok" && (
          <div className="mt-6 rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
            Mensagem enviada! Vamos responder o quanto antes.
          </div>
        )}
        {state === "err" && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {erro}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Nome" name="nome" required />
          <Field label="E-mail" name="email" type="email" required />
          <Field label="Assunto" name="assunto" />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mensagem
            </label>
            <textarea
              name="mensagem"
              required
              rows={6}
              maxLength={4000}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            disabled={state === "sending"}
            className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {state === "sending" ? "Enviando…" : "Enviar mensagem"}
          </button>
        </form>
      </div>
    </SiteLayout>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  );
}
