import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PageContainer } from "@/components/PageContainer";
import { AdvisoryEnquiry } from "@/components/billing/AdvisoryEnquiry";
import { ComingSoonRow } from "@/components/billing/ComingSoonRow";
import { getClient } from "@/lib/clients.functions";
import { getMyLockedModules } from "@/lib/card-model.functions";

export const Route = createFileRoute("/_authenticated/clients/$clientId/advisory")({
  staticData: { sitemap: false },
  validateSearch: z.object({ module: z.string().regex(/^[a-z_]+$/).optional() }),
  head: () => ({ meta: [{ title: "Upgrade to Advisory — Traction Advisory" }] }),
  component: Page,
});

function Page() {
  const { clientId } = Route.useParams();
  const { module } = Route.useSearch();
  const fetchClient = useServerFn(getClient), fetchLocked = useServerFn(getMyLockedModules);
  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClient({ data: { clientId } }), retry: false });
  const lockedQ = useQuery({ queryKey: ["client-locked-modules", clientId], queryFn: () => fetchLocked({ data: { clientId } }), retry: false });
  const firmId = (clientQ.data as any)?.client?.firm_id as string | undefined;
  const locked = lockedQ.data?.modules ?? [];
  // Server decides: no locked modules for this caller means no upgrade page.
  const allowed = locked.length > 0;
  return (
    <PageContainer>
      <h1 className="font-display text-lg font-semibold">Upgrade to Advisory</h1>
      <p className="mt-1 text-sm text-muted-foreground">See what each module adds, then send an enquiry to the Traction Advisory team.</p>
      <div className="mt-6 max-w-2xl">
        {clientQ.isLoading || lockedQ.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : !allowed || !firmId ? <p className="text-sm text-muted-foreground">Nothing to show here. <Link to="/clients/$clientId" params={{ clientId }} className="text-link underline">Back to the dashboard</Link></p>
          : <AdvisoryEnquiry firmId={firmId} inline initialModules={module && module !== "consolidation" && locked.includes(module) ? [module] : []}/>}
      </div>
      <div className="mt-8 max-w-4xl"><ComingSoonRow clientId={clientId} alwaysOpen /></div>
    </PageContainer>
  );
}
