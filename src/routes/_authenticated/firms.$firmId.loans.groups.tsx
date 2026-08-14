import { createFileRoute } from "@tanstack/react-router";
import { ConsolidationGroupsSection } from "@/components/admin/ConsolidationGroupsSection";

export const Route = createFileRoute("/_authenticated/firms/$firmId/loans/groups")({
  component: LoanGroupsTab,
});

function LoanGroupsTab() {
  const { firmId } = Route.useParams();
  return <ConsolidationGroupsSection firmId={firmId} />;
}
