import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/lib/use-sign-out";

/** Shared account cluster; the shell keeps Sign out in its existing menu. */
export function HeaderAccountActions({ actions, showSignOut = false }: { actions?: ReactNode; showSignOut?: boolean }) {
  const handleSignOut = useSignOut();
  const [initial, setInitial] = useState("");
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setInitial((data.user?.email ?? "").slice(0, 1).toUpperCase());
    });
    return () => { active = false; };
  }, []);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {actions}
      <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
        <Bell className="h-4 w-4" />
      </Button>
      <span aria-hidden className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground sm:flex">{initial}</span>
      {showSignOut && (
        <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} className="font-semibold">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      )}
    </div>
  );
}