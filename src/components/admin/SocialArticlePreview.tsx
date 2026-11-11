import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { getAdminPost } from "@/lib/admin.functions";
import { InstagramPostButton } from "@/components/admin/InstagramPostButton";
import { Button } from "@/components/ui/button";

export interface SocialArticlePreviewProps { id: string }

export function SocialArticlePreview({ id }: SocialArticlePreviewProps) {
  const read = useServerFn(getAdminPost);
  const query = useQuery({ queryKey: ["admin-post", id], queryFn: () => read({ data: { id } }), staleTime: 30000 });
  if (query.isPending) return <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando matéria…</p>;
  if (query.isError) return <div role="alert"><p className="text-destructive">Não foi possível carregar a matéria.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  const post = query.data?.post;
  if (!post) return <p role="status" className="text-muted-foreground">Matéria não encontrada.</p>;
  return <section aria-label="Matéria selecionada" className="min-w-0 space-y-4">
    {post.imagem_capa && <img src={post.imagem_capa} alt={post.titulo} className="aspect-video w-full rounded-md object-cover object-center" />}
    <h2 className="font-display text-2xl text-foreground">{post.titulo}</h2>
    {post.resumo && <p className="text-sm text-muted-foreground">{post.resumo}</p>}
    <div className="flex flex-wrap gap-2">
      <InstagramPostButton key={id} article={{ titulo: post.titulo, resumo: post.resumo ?? "", conteudo: post.conteudo ?? "", imagemCapa: post.imagem_capa ?? "", creditoImagem: post.credito_imagem ?? "", slug: post.slug }} />
      <Button variant="ghost" asChild><a href={`https://hockey4life.com.br/${post.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /> Ver matéria</a></Button>
    </div>
    <p className="text-xs text-muted-foreground">A publicação é concluída no Instagram ou no X. Baixe a imagem e copie a legenda; no X, o botão abre o texto pronto, mas a imagem precisa ser anexada.</p>
  </section>;
}