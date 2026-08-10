import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFirm } from "@/lib/firms.functions";
import { getMyContext } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Loader2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionEditor } from "@/components/admin/SubscriptionEditor";
import { ViewAsBanner } from "@/components/admin/ViewAsBanner";
import { FirmClientsSection } from "@/components/admin/FirmClientsSection";

import { Badge } from "@/components/ui/badge";
import { firmPlanView, toneClasses } from "@/lib/firmPlans";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/firms/$firmId")({
  validateSearch: (search: Record<string, unknown>): { viewAs?: string } =>
    typeof search.viewAs === "string" ? { viewAs: search.viewAs } : {},
  head: () => ({ meta: [{ title: "Organisation — Traction Advisory" }] }),
  component: FirmPage,
});


function FirmPage() {
  const { firmId } = Route.useParams();
  const { viewAs } = Route.useSearch();
  const previewing = viewAs === "owner";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFirm = useServerFn(getMyFirm);
  const fetchCtx = useServerFn(getMyContext);
  const [planOpen, setPlanOpen] = useState(false);

  const firmQ = useQuery({
    queryKey: ["my-firm", firmId],
    queryFn: () => fetchFirm({ data: { firmId } }),
    retry: false,
  });

  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  // While previewing as the organisation owner, hide platform-admin-only controls.
  const isSuper = (ctxQ.data?.isSuperAdmin ?? false) && !previewing;

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

        <div>
          <h1 className="font-display text-3xl font-semibold">{firm.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients for this organisation. Add or remove them here.
          </p>
        </div>

        {/* Plan & subscription */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Plan &amp; subscription
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{planV.planLabel}</Badge>
                <Badge variant="outline" className={toneClasses(planV.statusTone)}>{planV.statusLabel}</Badge>
                <span className="text-muted-foreground tabular-nums">
                  {plan.clientCount} of {plan.clientLimit} clients used
                </span>
                {planV.dueLabel && <span className="text-muted-foreground">· {planV.dueLabel}</span>}
              </div>
            </div>
            {isSuper ? (
              <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Edit plan
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Contact support to change this plan.</p>
            )}
          </div>
        </div>

        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Plan &amp; subscription</DialogTitle>
              <DialogDescription>{firm.name}</DialogDescription>
            </DialogHeader>
            <SubscriptionEditor
              firmId={firmId}
              subscription={{
                tier: plan.tier,
                status: plan.status,
                trial_ends_at: plan.trialEndsAt,
                current_period_end: plan.currentPeriodEnd,
                cancel_at_period_end: (plan as any).cancelAtPeriodEnd ?? false,
              }}
              isAlwaysFree={!!plan.isAlwaysFree}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["my-firm", firmId] });
                setPlanOpen(false);
              }}
              submitLabel="Save plan"
            />
          </DialogContent>
        </Dialog>

        <div className="mt-8">
          <FirmClientsSection
            firmId={firmId}
            firmName={firm.name}
            clientLimit={plan.clientLimit}
            planLabel={planV.planLabel}
          />
        </div>
      </main>
    </div>
  );
}

