import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFirm } from "@/lib/firms.functions";
import { AddClientsPanel } from "@/components/firm/AddClientsPanel";
import { FirmClientsSection } from "@/components/admin/FirmClientsSection";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/firms/$firmId/add-client")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Add client — Traction Advisory" },
      { name: "description", content: "Add a client to this organisation from Xero or manually." },
      { property: "og:title", content: "Add client — Traction Advisory" },
      { property: "og:description", content: "Add a client to this organisation from Xero or manually." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddClientPage,
});

function AddClientPage() {
  const { firmId } = Route.useParams();
  const fetchFirm = useServerFn(getMyFirm);
  // Same caller-scoped organisation read as the landing page; add actions are
  // still enforced by the existing server writes and plan-limit triggers.
  const q = useQuery({ queryKey: ["my-firm", firmId], queryFn: () => fetchFirm({ data: { firmId } }), retry: false });
  if (q.isError) return <PageContainer><p className="text-sm text-muted-foreground">You don't have access to that organisation.</p></PageContainer>;
  if (!q.data) return null;
  return (
    <PageContainer className="space-y-8">
      <h1 className="font-display text-lg font-semibold">Add client</h1>
      <AddClientsPanel firmId={firmId} />
      <FirmClientsSection firmId={firmId} firmName={q.data.firm.name} clientLimit={q.data.plan.clientLimit} showAddActions={false} />
    </PageContainer>
  );
}
