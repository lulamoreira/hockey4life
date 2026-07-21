import { Link } from "@tanstack/react-router";
import { Capacete } from "./Capacete";

/**
 * Logo H4L: capacete + marca escrita.
 * No mobile mostra apenas o capacete.
 * A imagem `/logo-script.png` deve ser anexada em public/.
 */
export function Logo() {
  return (
    <Link
      to="/"
      aria-label="Hockey4Life — página inicial"
      className="flex items-center gap-3"
    >
      <Capacete size={34} color="#EDD91B" />
      <img
        src="/logo-script.png"
        alt="Hockey4Life"
        className="hidden h-[30px] w-auto md:block"
        onError={(e) => {
          // fallback tipográfico enquanto o PNG oficial não é enviado
          const el = e.currentTarget;
          el.style.display = "none";
          const sib = el.nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = "inline-flex";
        }}
      />
      <span className="hidden items-center gap-1 md:inline-flex" style={{ display: "none" }}>
        <span className="h4l-title text-2xl leading-none text-primary">HOCKEY</span>
        <span className="h4l-title text-2xl leading-none text-foreground">4LIFE</span>
      </span>
    </Link>
  );
}
