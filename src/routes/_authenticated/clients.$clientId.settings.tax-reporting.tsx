import { createFileRoute } from "@tanstack/react-router";
import { ClientSettingsPage } from "@/components/clients/ClientSettingsPage";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings/tax-reporting")({
  head: () => ({ meta: [{ title: "Tax Reporting — Client settings" }] }),
  component: Page,
});
function Page() { const { clientId } = Route.useParams(); return <ClientSettingsPage clientId={clientId} section="tax-reporting" />; }
