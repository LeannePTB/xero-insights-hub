import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { OrganisationNameCard } from "@/components/firm/OrganisationNameCard";
import { LogoUploadCard } from "@/components/branding/LogoUploadCard";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings/general")({
  head: () => ({
    meta: [
      { title: "General settings — Organisation settings" },
      { name: "description", content: "Organisation name and report logo." },
      { property: "og:title", content: "General settings — Organisation settings" },
      { property: "og:description", content: "Organisation name and report logo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  const { firmId } = Route.useParams();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <FirmPageHeader title="General settings" description="Organisation name and report logo." />
      <div className="space-y-6">
        <OrganisationNameCard firmId={firmId} />
        <LogoUploadCard scope="organisation" id={firmId} title="Report logo" description="Shown on this organisation's monthly management reports." />
      </div>
    </main>
  );
}
