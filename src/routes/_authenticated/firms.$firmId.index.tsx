import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFirm } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { ViewAsBanner } from "@/components/admin/ViewAsBanner";
import { FirmClientsSection } from "@/components/admin/FirmClientsSection";
import { CompanyConsolidationsCard } from "@/components/admin/CompanyConsolidationsCard";
import { XeroOnboardPickerDialog } from "@/components/admin/XeroOnboardPickerDialog";
import { firmPlanView } from "@/lib/firmPlans";
import { toast } from "sonner";



export const Route = createFileRoute("/_authenticated/firms/$firmId/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { viewAs?: string; xero_onboarded?: string; xero_error?: string; xero_pick?: string } => ({
    ...(typeof search.viewAs === "string" ? { viewAs: search.viewAs } : {}),
    ...(typeof search.xero_onboarded === "string"
      ? { xero_onboarded: search.xero_onboarded }
      : {}),
    ...(typeof search.xero_error === "string" ? { xero_error: search.xero_error } : {}),
    ...(typeof search.xero_pick === "string" ? { xero_pick: search.xero_pick } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Organisation — Traction Advisory" },
      {
        name: "description",
        content: "Manage this organisation's plan, clients, Xero files and consolidation groups.",
      },
      { property: "og:title", content: "Organisation — Traction Advisory" },
      {
        property: "og:description",
        content: "Manage this organisation's plan, clients, Xero files and consolidation groups.",
      },
    ],
  }),
  component: FirmPage,
});


function FirmPage() {
  const { firmId } = Route.useParams();
  const {
    viewAs,
    xero_onboarded: xeroOnboarded,
    xero_error: xeroError,
    xero_pick: xeroPick,
  } = Route.useSearch();

  const requestedPreview = viewAs === "owner";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFirm = useServerFn(getMyFirm);
  const fetchCtx = useServerFn(getMyContext);
  // Organisation-level features are gated by the plan (database-resolved).
  const canConsolidate = useFirmWidgets(firmId).can("loan_consolidation");


  const firmQ = useQuery({
    queryKey: ["my-firm", firmId],
    queryFn: () => fetchFirm({ data: { firmId } }),
    retry: false,
  });

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  // Previewing is for platform admins and advisors only.
  const previewing = requestedPreview && (ctxQ.data?.canViewAs ?? false);
  // While previewing as the organisation owner, hide platform-admin-only controls.



  useEffect(() => {
    if (!xeroOnboarded && !xeroError) return;
    if (xeroOnboarded) toast.success(xeroOnboarded);
    if (xeroError) toast.error(xeroError);
    qc.invalidateQueries({ queryKey: ["clients", firmId] });
    navigate({
      to: "/firms/$firmId",
      params: { firmId },
      search: (prev: any) => ({ ...prev, xero_onboarded: undefined, xero_error: undefined }),
      replace: true,
    });
  }, [xeroOnboarded, xeroError, firmId, navigate, qc]);

  useEffect(() => {
    if (firmQ.error) {
      toast.error("You don't have access to that organisation.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [firmQ.error, navigate]);

  if (firmQ.isLoading || !firmQ.data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firm = firmQ.data.firm;
  const plan = firmQ.data.plan;
  const planV = firmPlanView({
    tier: plan.tier,
    status: plan.status,
    is_always_free: plan.isAlwaysFree,
    trial_ends_at: plan.trialEndsAt,
    current_period_end: plan.currentPeriodEnd,
  });

  return (
    <div className="min-h-screen bg-background">
      {previewing && (
        <ViewAsBanner
          label={`${firm.name} — as the organisation owner`}
          note="Layout and controls only; data access is unchanged"
        />
      )}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {!previewing && (
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All organisations</Link>
          </Button>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">{firm.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Clients for this organisation. Add or remove them here.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/firms/$firmId/settings" params={{ firmId }}>
              <Settings className="mr-1 h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>







        {xeroPick && (
          <XeroOnboardPickerDialog
            firmId={firmId}
            state={xeroPick}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["clients", firmId] });
              navigate({
                to: "/firms/$firmId",
                params: { firmId },
                search: (prev: any) => ({ ...prev, xero_pick: undefined }),
                replace: true,
              });
            }}
          />
        )}




        {canConsolidate && (
          <div className="mt-8">
            <CompanyConsolidationsCard firmId={firmId} />
          </div>
        )}

        <div className="mt-8">
          <FirmClientsSection
            firmId={firmId}
            firmName={firm.name}
            clientLimit={plan.clientLimit}
            planLabel={planV.planLabel}
            showAddActions={false}
          />
        </div>




      </main>
    </div>
  );
}
