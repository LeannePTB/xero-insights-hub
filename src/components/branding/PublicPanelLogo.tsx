import { useState } from "react";
import { DEFAULT_BRANDING, type PlatformBranding } from "@/hooks/usePlatformBranding";
import colourAsset from "@/assets/traction-advisory-official-colour.asset.json";

/** Display metadata only; no authentication or organisation-brand resolution. */
export function PublicPanelLogo({ brand, navy = false }: { brand: PlatformBranding; navy?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const uploadedWhite = navy && brand.logoDark !== brand.logoLight && brand.logoDark !== DEFAULT_BRANDING.logoDark;
  const candidate = uploadedWhite ? brand.logoDark : brand.logoLight !== DEFAULT_BRANDING.logoLight ? brand.logoLight : colourAsset.url;
  const source = failed === candidate ? colourAsset.url : candidate;
  const bare = uploadedWhite && failed !== candidate;
  return <span className={`public-panel-logo${bare ? " public-panel-logo-bare" : ""}`}>
    <img src={source} alt={brand.productName} onError={() => setFailed(candidate)} />
  </span>;
}
