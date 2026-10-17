import { createFileRoute } from "@tanstack/react-router";
import { ClientSettingsPage } from "@/components/clients/ClientSettingsPage";

export const Route = createFileRoute("/_authenticated/clients/$clientId/settings/account-setup")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Account setup — Client settings" }, { name: "description", content: "Bank, tax and cost choices for this client's Xero accounts." }] }),
  component: Page,
});
function Page() { const { clientId } = Route.useParams(); return <ClientSettingsPage clientId={clientId} section="account-setup" />; }
