import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/roles.functions";
import { AdminNavShell } from "@/components/admin/AdminNavShell";

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

    return { user: data.user };
  },
  component: () => <Outlet />,
});
