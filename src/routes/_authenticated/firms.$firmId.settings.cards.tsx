import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { OrgCardDefaultsCard } from "@/components/admin/OrgCardDefaultsCard";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/cards")({
  head: () => ({
    meta: [
      { title: "Card defaults — Organisation settings" },
      { name: "description", content: "The dashboard cards new clients start with." },
      { property: "og:title", content: "Card defaults — Organisation settings" },
      { property: "og:description", content: "The dashboard cards new clients start with." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CardDefaultsPage,
});

function CardDefaultsPage() {
  const { firmId } = Route.useParams();
  return (
    <PageContainer width="readable" className="space-y-6">
      <FirmPageHeader title="Card defaults" description="The dashboard cards new clients start with." />
      <OrgCardDefaultsCard firmId={firmId} />
    </PageContainer>
  );
}
