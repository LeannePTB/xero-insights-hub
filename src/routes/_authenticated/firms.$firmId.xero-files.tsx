import { createFileRoute } from "@tanstack/react-router";
import { FirmPageHeader } from "@/components/firm/FirmPageHeader";
import { FirmXeroFilesCard } from "@/components/admin/FirmXeroFilesCard";

export const Route = createFileRoute("/_authenticated/firms/$firmId/xero-files")({
  head: () => ({
    meta: [
      { title: "Xero files — Organisation" },
      { name: "description", content: "The Xero files connected to this organisation and which client each belongs to." },
      { property: "og:title", content: "Xero files — Organisation" },
      { property: "og:description", content: "Xero files connected to this organisation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: XeroFilesPage,
});

function XeroFilesPage() {
  const { firmId } = Route.useParams();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <FirmPageHeader title="Xero files" description="Xero files connected to this organisation." />
      <FirmXeroFilesCard firmId={firmId} />
    </main>
  );
}
