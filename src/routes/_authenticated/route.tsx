import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
