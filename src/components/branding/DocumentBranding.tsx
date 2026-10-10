import { useEffect } from "react";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";

export function DocumentBranding() {
  const brand = useWorkspaceBranding();
  useEffect(() => {
    const baseTitle = document.title.replace(/ — [^—]+$/, "");
    document.title = `${baseTitle} — ${brand.productName}`;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = brand.favicon ?? "/favicon.png";
  }, [brand.favicon, brand.productName]);
  return null;
}