import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { PeopleSection } from "@/components/people/PeopleSection";
import { useFirmSettingsSummary } from "@/components/firm/useFirmSettingsSummary";

export const Route = createFileRoute("/_authenticated/firms/$firmId/people")({
  head: () => ({
    meta: [
      { title: "People & access — Organisation" },
      { name: "description", content: "Team members, business owners and external advisers for this organisation." },
      { property: "og:title", content: "People & access — Organisation" },
      { property: "og:description", content: "Team members, business owners and external advisers." },
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
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <FirmPageHeader
        title="People & access"
        description="Manage Team members, Business owners and External advisers. Access is shown separately by relationship and scope."
      />
      {q.isLoading ? null : q.data?.isMember ? (
        <PeopleSection firmId={firmId} />
      ) : (
        <p className="text-sm text-muted-foreground">Only members of this organisation can manage its people.</p>
      )}
    </main>
  );
}
