import { createFileRoute } from "@tanstack/react-router";
import { ClientSettingsPage } from "@/components/clients/ClientSettingsPage";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings/general")({
  head: () => ({ meta: [{ title: "General — Client settings" }] }),
  component: Page,
});
function Page() { const { clientId } = Route.useParams(); return <ClientSettingsPage clientId={clientId} section="general" />; }
