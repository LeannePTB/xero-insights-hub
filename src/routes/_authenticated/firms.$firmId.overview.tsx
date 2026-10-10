import { createFileRoute } from "@tanstack/react-router";
import { OverviewView } from "@/components/overview/OverviewView";

export const Route = createFileRoute("/_authenticated/firms/$firmId/overview")({
  head: () => ({
    meta: [
      { title: "Organisation overview — Traction Advisory" },
      { name: "description", content: "Every client in this organisation, worst first, with what changed recently." },
      { property: "og:title", content: "Organisation overview — Traction Advisory" },
      { property: "og:description", content: "Client health for this organisation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirmOverview,
});

function FirmOverview() {
  const { firmId } = Route.useParams();
  // firmId is a filter on the caller's own access, never a grant.
  return <OverviewView firmId={firmId} />;
}
