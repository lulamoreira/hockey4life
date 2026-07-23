import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Hockey4Life" },
      { name: "description", content: "Como o Hockey4Life trata os dados pessoais dos leitores cadastrados: quais dados guardamos, para quê, e como pedir a exclusão da conta." },
      { property: "og:title", content: "Política de privacidade — Hockey4Life" },
      { property: "og:description", content: "Como o Hockey4Life trata os dados dos leitores cadastrados e como apagar sua conta." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <h1 className="h4l-title text-3xl text-primary md:text-5xl">Política de privacidade</h1>
        <div className="prose prose-invert mt-6 max-w-none text-foreground/90">
          <p><strong>Ler o Hockey4Life é livre e não exige cadastro.</strong> Você só nos dá dados pessoais se decidir criar uma conta de leitor.</p>

          <h2>Dados que guardamos de leitores cadastrados</h2>
          <ul>
            <li><strong>E-mail</strong>: para você entrar na conta.</li>
            <li><strong>Nome, telefone e data de nascimento</strong>: para identificar quem é você e checar idade mínima (13 anos).</li>
            <li><strong>Foto de perfil</strong> (opcional): apenas se você enviar.</li>
            <li><strong>Método de login</strong> (Google, magic link, senha) e datas de criação/atualização.</li>
          </ul>

          <h2>Para que usamos</h2>
          <p>Para autenticar você, personalizar sua experiência de leitura e, quando você autorizar, enviar comunicados sobre novas matérias. Não vendemos dados a terceiros.</p>

          <h2>Seus direitos (LGPD)</h2>
          <p>Você pode acessar, corrigir e <strong>apagar seus dados a qualquer momento</strong> pela tela <Link to="/conta" className="text-primary underline">Minha conta → Apagar conta</Link>. As matérias já publicadas com seu nome como autor(a) permanecem no ar — apagamos apenas os dados pessoais que ligam a conta a você.</p>

          <h2>Contato</h2>
          <p>Dúvidas sobre privacidade: use a página <Link to="/fale-conosco" className="text-primary underline">Fale conosco</Link>.</p>
        </div>
      </div>
    </SiteLayout>
  );
}
