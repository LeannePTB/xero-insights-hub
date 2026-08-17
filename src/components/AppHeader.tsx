import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/audit.functions";
import ptLogo from "@/assets/pt-logo.png.asset.json";

type Props = {
  /** Optional actions rendered before the notification / account cluster. */
  actions?: ReactNode;
};

/**
 * Global application header — mirrors the Business Hub bar:
 * logo · divider · wordmark on the left, actions / bell / avatar / sign out on the right.
 */
export function AppHeader({ actions }: Props) {
  const navigate = useNavigate();
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

  async function handleSignOut() {
    try {
      await logAuthEvent({ data: { action: "signed_out" } });
    } catch {
      /* audit is best-effort */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Traction Advisory Dashboards">
          <img src={ptLogo.url} alt="Positive Traction" className="h-9 w-auto shrink-0" />
          <span className="hidden border-l border-border pl-3 leading-tight sm:block">
            <span className="block text-[11px] font-bold uppercase tracking-[0.28em] text-accent">
              Traction Advisory
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
              Dashboards
            </span>
          </span>
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
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="font-semibold">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
