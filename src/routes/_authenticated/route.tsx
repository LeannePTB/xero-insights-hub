import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/roles.functions";
import { recordPresence } from "@/lib/security-posture.functions";
import { AppShell } from "@/components/shell/AppShell";
import { HeaderPresenceProvider } from "@/components/shell/shell-context";
import { GlobalSignOut } from "@/components/GlobalSignOut";
import { SessionIdleGuard } from "@/components/SessionIdleGuard";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // MFA enforcement: every authenticated user must have a verified TOTP
    // factor and the current session must be at AAL2.
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const hasVerified = (factorsData?.totp ?? []).some((f) => f.status === "verified");

    if (!hasVerified) throw redirect({ to: "/auth/mfa-enroll" });
    if (aalData?.currentLevel !== "aal2") throw redirect({ to: "/auth/mfa-verify" });

    // There is no daily sign-in cut-off (owner decision, 15 Sep 2026). The only
    // automatic end to a session is inactivity, handled by SessionIdleGuard in
    // the browser and enforced by the database and the request middleware.
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});



/**
 * Every signed-in (aal2) person records a heartbeat, whatever their role, so
 * the online list covers owners, staff and client viewers — not just admins.
 * The server sets the time; the browser only says "I am here". Pauses while
 * the tab is hidden and resumes on focus.
 */
function usePresenceHeartbeat() {
  const beat = useServerFn(recordPresence);

  useEffect(() => {
    let stopped = false;
    const ping = () => {
      if (stopped || document.hidden) return;
      void beat({}).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 60_000);
    const onVisible = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [beat]);
}

function AuthenticatedLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  usePresenceHeartbeat();

  // Presentation only, from the server signal (never browser storage): the
  // side menu shows for platform staff and organisation members. Client viewers keep the bare layout. Every route keeps its own guard.
  const showMenu =
    ctxQ.data?.isPlatformStaff === true ||
    ctxQ.data?.isOrganisationMember === true;

  if (!showMenu)
    return (
      <HeaderPresenceProvider>
        <Outlet />
        <GlobalSignOut />
        <SessionIdleGuard />
      </HeaderPresenceProvider>
    );
  return (
    <AppShell>
      <Outlet />
      <SessionIdleGuard />
    </AppShell>
  );
}

