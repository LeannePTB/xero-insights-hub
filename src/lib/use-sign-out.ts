import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/audit.functions";
import { clearSignInMark } from "@/lib/session-cutoff";

/**
 * Shared sign-out: best-effort audit, clear the daily sign-in hint, end the
 * session, then land on the sign-in page. Used wherever a Sign out control
 * appears (app header, admin menu, settings pages).
 */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    try {
      await logAuthEvent({ data: { action: "signed_out" } });
    } catch {
      /* audit is best-effort */
    }
    clearSignInMark();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
}
