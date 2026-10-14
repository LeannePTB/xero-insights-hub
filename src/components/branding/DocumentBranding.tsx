import { useEffect } from "react";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { useLocation } from "@tanstack/react-router";

export function DocumentBranding() {
  const brand = useWorkspaceBranding();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== '/') {
      const baseTitle = document.title.replace(/ — [^—]+$/, "");
      document.title = `${baseTitle} — ${brand.productName}`;
    }
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = brand.whiteLabelEnabled ? (brand.favicon ?? "/favicon.png") : "/favicon.png";
    icon.type = "image/png";
  }, [brand.favicon, brand.productName, brand.whiteLabelEnabled, pathname]);
  return null;
}