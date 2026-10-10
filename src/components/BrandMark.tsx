import { Link } from "@tanstack/react-router";
import { usePlatformBranding } from "@/hooks/usePlatformBranding";

type Props = {
  className?: string;
  /** Use on dark backgrounds — wraps the logo in a light pill so it stays readable. */
  onDark?: boolean;
  /** Tailwind height class for the logo image. Defaults to h-10. */
  logoHeightClass?: string;
};

export function BrandMark({ className = "", onDark = false, logoHeightClass = "h-10" }: Props) {
  const brand = usePlatformBranding();
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`} aria-label={`${brand.productName} Dashboards`}>
      {onDark ? (
        <span className="rounded-md bg-white/95 px-2 py-1 shadow-sm">
          <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} w-auto`} />
        </span>
      ) : (
        <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} w-auto`} />
      )}
      <span
        className={`hidden border-l pl-3 text-[11px] font-semibold uppercase tracking-[0.28em] sm:inline-block ${
          onDark ? "border-white/25 text-accent" : "border-border text-accent"
        }`}
      >
        {brand.productName}
        <span className="block text-[10px] tracking-[0.24em] opacity-80">Dashboards</span>
      </span>
    </Link>
  );
}
