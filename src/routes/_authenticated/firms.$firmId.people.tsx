import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { PeopleSection } from "@/components/people/PeopleSection";
import { useFirmSettingsSummary } from "@/components/firm/useFirmSettingsSummary";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/firms/$firmId/people")({
  head: () => ({
    meta: [
      { title: "People & access — Organisation" },
      { name: "description", content: "Team members, business owners and Viewers for this organisation." },
      { property: "og:title", content: "People & access — Organisation" },
      { property: "og:description", content: "Team members, business owners and Viewers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { firmId } = Route.useParams();
  const q = useFirmSettingsSummary(firmId);
  return (
    <PageContainer className="space-y-6">
      <FirmPageHeader
        title="People & access"
        description="Manage Team members, Business Owners and Viewers. Access is shown separately by relationship and scope."
      />
      {q.isLoading ? null : q.data?.isMember ? (
        <PeopleSection firmId={firmId} />
      ) : (
        <p className="text-sm text-muted-foreground">Only members of this organisation can manage its people.</p>
      )}
    </PageContainer>
  );
}
