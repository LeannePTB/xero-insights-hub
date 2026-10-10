import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { TransferOwnershipCard } from "@/components/admin/TransferOwnershipCard";
import { PageContainer } from "@/components/PageContainer";

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
    <PageContainer width="readable" className="space-y-6">
      <FirmPageHeader title="Ownership" description="Hand this organisation over to another member." />
      <TransferOwnershipCard firmId={firmId} />
    </PageContainer>
  );
}
