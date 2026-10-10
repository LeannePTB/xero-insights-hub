import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { OrgPurchaseCard } from "@/components/admin/OrgPurchaseCard";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — Organisation settings" },
      { name: "description", content: "What this organisation has bought or is trialling." },
      { property: "og:title", content: "Subscription — Organisation settings" },
      { property: "og:description", content: "What this organisation has bought or is trialling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { firmId } = Route.useParams();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <FirmPageHeader title="Subscription" description="What this organisation has bought or is trialling." />
      <OrgPurchaseCard firmId={firmId} />
    </main>
  );
}
