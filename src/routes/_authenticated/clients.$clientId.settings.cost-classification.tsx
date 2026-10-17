import { createFileRoute, redirect } from "@tanstack/react-router";

// Retired tab: its account choices now live on Account setup.
export const Route = createFileRoute("/_authenticated/clients/$clientId/settings/cost-classification")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/clients/$clientId/settings/account-setup", params: { clientId: params.clientId }, hash: "account-setup-cost", replace: true });
  },
});
