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
  component: AuthenticatedLayout,
});

/** Routes that already render the admin menu through AdminShell. */
function ownsAdminMenu(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/settings/tiers") ||
    pathname.startsWith("/settings/advisors")
  );
}

function AuthenticatedLayout() {
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Presentation only: the menu appears for platform super admins, decided by
  // the same server-side signal the admin screens use. Anyone else — including
  // client viewers and ordinary organisation members — never renders it, and
  // every route behind it keeps its own unchanged guard.
  const showAdminMenu = ctxQ.data?.isSuperAdmin === true && !ownsAdminMenu(pathname);

  if (!showAdminMenu) return <Outlet />;
  return (
    <AdminNavShell>
      <Outlet />
    </AdminNavShell>
  );
}
