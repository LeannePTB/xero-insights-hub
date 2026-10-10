import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFirmsAdmin } from "@/lib/admin.functions";
import { XeroUsageCard } from "@/components/admin/XeroUsageCard";
import { XeroErrorBreakdownCard } from "@/components/admin/XeroErrorBreakdownCard";
import { OrphanXeroConnectionsCard } from "@/components/admin/OrphanXeroConnectionsCard";

export const Route = createFileRoute("/_authenticated/system/xero")({
  head: () => ({
    meta: [
      { title: "Xero monitoring — System Admin" },
      { name: "description", content: "Xero request allowance, API errors and unlinked Xero connections across the platform." },
      { property: "og:title", content: "Xero monitoring — System Admin" },
      { property: "og:description", content: "Xero request allowance, API errors and unlinked Xero connections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: XeroMonitoringPage,
});

function XeroMonitoringPage() {
  const fetchFirms = useServerFn(listFirmsAdmin);
  const firmsQ = useQuery({ queryKey: ["admin-firms"], queryFn: () => fetchFirms() });
  const firms = (((firmsQ.data as any)?.firms ?? []) as any[]).map((f) => ({ id: f.firm_id as string, name: f.firm_name as string }));
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-foreground">Xero monitoring</h1>
      <XeroUsageCard />
      <XeroErrorBreakdownCard />
      <OrphanXeroConnectionsCard firms={firms} />
    </main>
  );
}
