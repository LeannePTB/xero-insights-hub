import { Link } from "@tanstack/react-router";
import { DEFAULT_BRANDING, usePlatformBranding } from "@/hooks/usePlatformBranding";

type Props = {
  className?: string;
  /** Use approved dark artwork; never put the colour logo on a dark surface. */
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
          brand.logoDark !== brand.logoLight && brand.logoDark !== DEFAULT_BRANDING.logoDark ?
            <img src={brand.logoDark} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} /> :
            <span className="text-lg font-semibold text-primary-foreground">{brand.productName}</span>
        ) : (
          <img src={brand.logoLight} alt={brand.productName} className={`${logoHeightClass} max-w-full w-auto object-contain`} />
        )
      ) : (
        <span className="text-lg font-semibold tracking-tight">{brand.productName}</span>
      )}
    </Link>
  );
}

