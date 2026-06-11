import { Link } from "@tanstack/react-router";
import ptLogo from "@/assets/pt-logo.png.asset.json";

type Props = {
  className?: string;
  /** Use on dark backgrounds — wraps the logo in a light pill so it stays readable. */
  onDark?: boolean;
  /** Tailwind height class for the logo image. Defaults to h-10. */
  logoHeightClass?: string;
};

export function BrandMark({ className = "", onDark = false, logoHeightClass = "h-10" }: Props) {
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`} aria-label="Positive Traction — Traction Advisory Dashboards">
      {onDark ? (
        <span className="rounded-md bg-white/95 px-2 py-1 shadow-sm">
          <img src={ptLogo.url} alt="Positive Traction" className={`${logoHeightClass} w-auto`} />
        </span>
      ) : (
        <img src={ptLogo.url} alt="Positive Traction" className={`${logoHeightClass} w-auto`} />
      )}
      <span
        className={`hidden border-l pl-3 text-[11px] font-semibold uppercase tracking-[0.28em] sm:inline-block ${
          onDark ? "border-white/25 text-accent" : "border-border text-accent"
        }`}
      >
        Traction Advisory
        <span className="block text-[10px] tracking-[0.24em] opacity-80">Dashboards</span>
      </span>
    </Link>
  );
}
