import { Link } from "@tanstack/react-router";
import { usePlatformBranding } from "@/hooks/usePlatformBranding";

type Props = {
  className?: string;
  /** Use on dark backgrounds — wraps the logo in a light pill so it stays readable. */
  onDark?: boolean;
  /** Tailwind height class for the logo image. Defaults to h-10. */
  logoHeightClass?: string;
};

export function BrandMark({ className = "", onDark = false, logoHeightClass = "h-9" }: Props) {
  const brand = usePlatformBranding();
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`} aria-label={`${brand.productName} Dashboards`}>
      {onDark ? (
        <span className="rounded-md bg-brand-surface px-2 py-1 shadow-sm">
          <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} />
        </span>
      ) : (
        <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} />
      )}
    </Link>
  );
}
