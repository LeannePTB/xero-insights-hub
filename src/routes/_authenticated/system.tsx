import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyContext } from "@/lib/roles.functions";

/**
 * System Admin area (Path C: platform metadata only, never client figures).
 * This layout check is defence in depth for navigation; every page's server
 * functions still enforce System Administrator + aal2 in the database.
 */
export const Route = createFileRoute("/_authenticated/system")({
  beforeLoad: async ({ context }) => {
    const ctx = await (context as any).queryClient.ensureQueryData({
      queryKey: ["my-context"],
      queryFn: () => getMyContext(),
    });
    if (!ctx?.isSuperAdmin) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
