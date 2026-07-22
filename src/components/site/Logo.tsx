import { Link } from "@tanstack/react-router";

/**
 * Logo H4L — versão tipográfica (mesma usada no Admin, por enquanto).
 */
export function Logo() {
  return (
    <Link
      to="/"
      aria-label="Hockey4Life — página inicial"
      className="flex items-center gap-1"
    >
      <span className="h4l-title text-2xl leading-none text-primary md:text-3xl">HOCKEY</span>
      <span className="h4l-title text-2xl leading-none text-foreground md:text-3xl">4LIFE</span>
    </Link>
  );
}
