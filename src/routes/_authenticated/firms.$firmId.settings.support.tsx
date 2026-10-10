import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { SupportAccessCard } from "@/components/admin/SupportAccessCard";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/support")({
  head: () => ({
    meta: [
      { title: "Support access — Organisation settings" },
      { name: "description", content: "Grant or revoke read-only support access for Traction Advisory staff." },
      { property: "og:title", content: "Support access — Organisation settings" },
      { property: "og:description", content: "Grant or revoke read-only support access for Traction Advisory staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { firmId } = Route.useParams();
  return (
    <PageContainer width="readable" className="space-y-6">
      <FirmPageHeader title="Support access" description="Grant or revoke read-only support access for Traction Advisory staff." />
      <SupportAccessCard firmId={firmId} />
    </PageContainer>
  );
}
