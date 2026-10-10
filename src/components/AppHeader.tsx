import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/lib/use-sign-out";
import { useWorkspaceBranding } from "@/hooks/useWorkspaceBranding";
import { useInAppShell, useRegisterHeader } from "@/components/shell/shell-context";

type Props = {
  /** Optional actions rendered before the notification / account cluster. */
  actions?: ReactNode;
};

/**
 * Global application header: logo · wordmark on the left, actions / bell /
 * avatar / sign out on the right. Inside AppShell the side menu carries
 * Sign out, so the header omits its own (decided by React context).
 */
export function AppHeader({ actions }: Props) {
  const handleSignOut = useSignOut();
  const brand = useWorkspaceBranding();
  const inShell = useInAppShell();
  useRegisterHeader();
  const [initial, setInitial] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const email = data.user?.email ?? "";
      setInitial(email.slice(0, 1).toUpperCase());
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <header data-app-header className="sticky top-0 z-40 border-b border-border/60 bg-card">
      <div className="flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${brand.productName} Dashboards`}>
          <img src={brand.logoLight} alt={brand.productName} className="h-9 max-w-48 w-auto shrink-0 object-contain" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {actions}
          <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
            <Bell className="h-4 w-4" />
          </Button>
          <span
            aria-hidden
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground sm:flex"
          >
            {initial}
          </span>
          {!inShell && (
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} className="font-semibold">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
