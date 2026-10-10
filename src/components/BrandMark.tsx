import { Link } from "@tanstack/react-router";
import { DEFAULT_BRANDING, usePlatformBranding } from "@/hooks/usePlatformBranding";

type Props = {
  className?: string;
  /** Use on dark backgrounds — renders the name in light text instead of wrapping the logo in a pill. */
  onDark?: boolean;
  /** Tailwind height class for the logo image. Defaults to h-9. */
  logoHeightClass?: string;
};

export function BrandMark({ className = "", onDark = false, logoHeightClass = "h-9" }: Props) {
  const brand = usePlatformBranding();
  const hasCustomLogo = brand.logoLight !== DEFAULT_BRANDING.logoLight;
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`} aria-label={`${brand.productName} Dashboards`}>
      {hasCustomLogo ? (
        onDark ? (
          <span className="rounded-md bg-brand-surface px-2 py-1 shadow-sm">
            <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} />
          </span>
        ) : (
          <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} />
        )
      ) : (
        <span className="text-lg font-semibold tracking-tight">{brand.productName}</span>
      )}
    </Link>
  );
}

