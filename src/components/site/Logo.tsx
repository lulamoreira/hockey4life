import { Link } from "@tanstack/react-router";
import logoEscuro from "@/assets/logo-escuro.png.asset.json";
import logoClaro from "@/assets/logo-claro.png.asset.json";

/**
 * Logo Hockey4Life. Alterna automaticamente entre a versão para fundo
 * escuro e a versão para fundo claro conforme o tema atual (classe .dark no <html>).
 *
 * As imagens têm fundo transparente — não envolvemos em box com background.
 * Servimos com altura fixa e largura automática (nunca esticado).
 */
export function Logo({ height = 40 }: { height?: number }) {
  return (
    <Link
      to="/"
      aria-label="Hockey4Life — página inicial"
      className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
    >
      <LogoImg height={height} />
    </Link>
  );
}

/** Apenas a imagem (sem link) — útil em headers do admin, telas de login etc. */
export function LogoImg({ height = 40, className = "" }: { height?: number; className?: string }) {
  return (
    <>
      {/* Tema escuro */}
      <img
        src={logoEscuro.url}
        alt="Hockey4Life"
        width={height * 3.2}
        height={height}
        style={{ height, width: "auto" }}
        className={`hidden select-none dark:block ${className}`}
        decoding="async"
        loading="eager"
        draggable={false}
      />
      {/* Tema claro */}
      <img
        src={logoClaro.url}
        alt="Hockey4Life"
        width={height * 3.2}
        height={height}
        style={{ height, width: "auto" }}
        className={`block select-none dark:hidden ${className}`}
        decoding="async"
        loading="eager"
        draggable={false}
      />
    </>
  );
}
