import { useEffect } from "react";
import { usePlatformBranding } from "@/hooks/usePlatformBranding";

export function DocumentBranding() {
  const brand = usePlatformBranding();
  useEffect(() => {
    if (document.title.includes("Traction Advisory")) {
      document.title = document.title.replaceAll("Traction Advisory", brand.productName);
    }
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