import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useCanManageClient } from "@/hooks/useCanManageClient";
import { ClientSettingsNav } from "@/components/clients/ClientSettingsNav";
import { ClientPageHeader } from "@/components/clients/ClientPageHeader";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings")({
  beforeLoad: ({ params, location }) => {
    if (location.pathname.endsWith("/settings")) {
      throw redirect({ to: "/clients/$clientId/settings/general", params: { clientId: params.clientId }, search: location.search });
    }
  },
  component: ClientSettingsLayout,
});

function ClientSettingsLayout() {
  const { clientId } = Route.useParams();
  const caps = useCanManageClient(clientId);
  if (caps.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!caps.canManage) return <div className="p-8 text-sm text-destructive">Client settings are available to organisation members only.</div>;
  return <div className="min-h-screen bg-background"><ClientPageHeader clientId={clientId} title="Client settings" /><ClientSettingsNav clientId={clientId} /><Outlet /></div>;
}
