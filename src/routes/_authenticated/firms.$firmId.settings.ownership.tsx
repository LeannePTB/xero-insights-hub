import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { TransferOwnershipCard } from "@/components/admin/TransferOwnershipCard";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/ownership")({
  head: () => ({
    meta: [
      { title: "Ownership — Organisation settings" },
      { name: "description", content: "Hand this organisation over to another member." },
      { property: "og:title", content: "Ownership — Organisation settings" },
      { property: "og:description", content: "Hand this organisation over to another member." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnershipPage,
});

function OwnershipPage() {
  const { firmId } = Route.useParams();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <FirmPageHeader title="Ownership" description="Hand this organisation over to another member." />
      <TransferOwnershipCard firmId={firmId} />
    </main>
  );
}
