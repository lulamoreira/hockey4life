import { Link } from "@tanstack/react-router";
import { LogoImg } from "./Logo";

export function Footer({ config }: { config: Record<string, any> }) {
  const rodape = config?.rodape ?? {};
  const contato = config?.contato ?? {};
  const redes = config?.redes_sociais ?? {};
  const ano = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <Link to="/" aria-label="Hockey4Life — página inicial" className="inline-block">
            <LogoImg height={36} />
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            {rodape.texto ??
              "Histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo."}
          </p>
        </div>
        <div>
          <div className="h4l-title text-sm text-foreground">Navegar</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-primary">Início</Link></li>
            <li><Link to="/arquivo" className="hover:text-primary">Arquivo</Link></li>
            <li><Link to="/busca" className="hover:text-primary">Buscar</Link></li>
            <li><Link to="/autor/$slug" params={{ slug: "diogo-finelli" }} className="hover:text-primary">Sobre o autor</Link></li>
            <li><Link to="/fale-conosco" className="hover:text-primary">Fale conosco</Link></li>
          </ul>
        </div>
        <div>
          <div className="h4l-title text-sm text-foreground">Contato</div>
          <p className="mt-3 text-sm text-muted-foreground">
            {contato.email ? (
              <a href={`mailto:${contato.email}`} className="hover:text-primary">{contato.email}</a>
            ) : null}
          </p>
          <div className="mt-3 flex gap-3 text-sm text-muted-foreground">
            {redes.instagram && <a href={redes.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Instagram</a>}
            {redes.facebook && <a href={redes.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Facebook</a>}
            {redes.x && <a href={redes.x} target="_blank" rel="noopener noreferrer" className="hover:text-primary">X</a>}
            {redes.youtube && <a href={redes.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-primary">YouTube</a>}
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center">
          <span>{rodape.creditos ?? "Agência Mecânica • Lula Moreira"} • © {ano}</span>
          <Link to="/admin" className="hover:text-primary">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
