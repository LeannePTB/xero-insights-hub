import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { usePlatformBranding } from "@/hooks/usePlatformBranding";
import { PublicPanelLogo } from "@/components/branding/PublicPanelLogo";

/** Presentation only: session, invitation and MFA decisions stay in each route. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const brand = usePlatformBranding();
  return (
    <div className="auth-layout">
      <div className="auth-form-panel">
        <Link to="/" aria-label={`${brand.productName} home`} className="auth-logo-link">
          <PublicPanelLogo brand={brand} />
        </Link>
        <Link to="/" className="auth-home-link"><ArrowLeft className="size-3.5" aria-hidden="true" /> Back to tractionadvisory.com.au</Link>
        <div className="auth-form-content">{children}</div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} {brand.productName}</span>
          <span aria-hidden="true">·</span><Link to="/security">Report a security issue</Link>
          <span aria-hidden="true">·</span><Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span><Link to="/terms">Terms</Link>
        </footer>
      </div>
    </div>
  );
}