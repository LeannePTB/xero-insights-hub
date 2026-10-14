import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_BRANDING, usePlatformBranding } from "@/hooks/usePlatformBranding";
import overviewImage from "@/assets/website-overview.jpg";

/** Presentation only: session, invitation and MFA decisions stay in each route. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const brand = usePlatformBranding();
  const darkLogo = brand.logoDark !== brand.logoLight ? brand.logoDark : DEFAULT_BRANDING.logoDark;
  return (
    <div className="auth-layout">
      <aside className="auth-brand-panel">
        <Link to="/" aria-label={`${brand.productName} home`} className="auth-logo-link">
          <img src={darkLogo} alt={brand.productName} className="auth-logo" onError={(event) => {
            if (event.currentTarget.src !== new URL(DEFAULT_BRANDING.logoDark, window.location.origin).href) event.currentTarget.src = DEFAULT_BRANDING.logoDark;
          }} />
        </Link>
        <div className="auth-brand-message">
          <h2>Better client conversations.<br />Backed by their numbers.</h2>
          <p>Clear Xero dashboards and monthly reports for practices and their clients.</p>
          <img src={overviewImage} alt="" aria-hidden="true" className="auth-illustration" />
        </div>
      </aside>
      <div className="auth-form-panel">
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