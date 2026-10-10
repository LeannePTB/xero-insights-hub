import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { OrganisationNameCard } from "@/components/firm/OrganisationNameCard";
import { LogoUploadCard } from "@/components/branding/LogoUploadCard";
import { PageContainer } from "@/components/PageContainer";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/general")({
  head: () => ({
    meta: [
      { title: "General settings — Organisation settings" },
      { name: "description", content: "Organisation name and logo." },
      { property: "og:title", content: "General settings — Organisation settings" },
      { property: "og:description", content: "Organisation name and logo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  const { firmId } = Route.useParams();
  return (
    <PageContainer width="readable" className="space-y-6">
      <FirmPageHeader title="General settings" description="Organisation name and logo." />
      <div className="space-y-6">
        <OrganisationNameCard firmId={firmId} />
        <LogoUploadCard scope="organisation" id={firmId} title="Organisation logo" description="Shown on reports and, while White label is active, in this organisation's app and emails. Use a transparent PNG where possible, at least 320 px wide, with no small text. PNG or JPEG, up to 2 MB." />
      </div>
    </PageContainer>
  );
}
