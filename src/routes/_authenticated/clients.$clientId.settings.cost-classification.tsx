import { createFileRoute } from "@tanstack/react-router";
import { ClientSettingsPage } from "@/components/clients/ClientSettingsPage";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings/cost-classification")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Cost classification — Client settings" }] }),
  component: Page,
});
function Page() { const { clientId } = Route.useParams(); return <ClientSettingsPage clientId={clientId} section="cost-classification" />; }
