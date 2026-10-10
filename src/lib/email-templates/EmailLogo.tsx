import { Img } from "@react-email/components";
import bundledLogo from "@/assets/traction-advisory-logo.png?inline";

/** Platform assets are public display metadata; never pass a private organisation logo. */
export function EmailLogo({ logoSrc = bundledLogo, siteName = "Traction Advisory" }: { logoSrc?: string | null; siteName?: string }) {
  if (logoSrc === null) return null;
  return <Img src={logoSrc} alt={siteName} height={36} style={{ height: "36px", width: "auto", maxWidth: "180px", objectFit: "contain", marginBottom: "20px" }} />;
}
