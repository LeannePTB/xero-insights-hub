import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Loader2, ShieldAlert } from "lucide-react";
import { SupportAccessCard } from "@/components/admin/SupportAccessCard";
import { getFirmPlanSummary, saveFirmDefaultWidgets } from "@/lib/tier-config.functions";
import { WIDGET_LABEL, type WidgetKey } from "@/lib/tiers";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  changeFirmPlan,
  getFirmSubscription,
  setFirmCancellation,
} from "@/lib/firm-subscription.functions";
import { firmPlanView, toneClasses } from "@/lib/firmPlans";

export const Route = createFileRoute("/_authenticated/firms/$firmId/settings")({
  head: () => ({
    meta: [
      { title: "Organisation settings — Traction Advisory" },
      {
        name: "description",
        content: "Review your plan, change your subscription or cancel it for this organisation.",
      },
      { property: "og:title", content: "Organisation settings — Traction Advisory" },
      {
        property: "og:description",
        content: "Review your plan, change your subscription or cancel it for this organisation.",
      },
    ],
  }),
  component: FirmSettingsPage,
});

function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString();
}

function FirmSettingsPage() {
  const { firmId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSub = useServerFn(getFirmSubscription);
  const changePlan = useServerFn(changeFirmPlan);
  const setCancel = useServerFn(setFirmCancellation);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const q = useQuery({
    queryKey: ["firm-subscription", firmId],
    queryFn: () => fetchSub({ data: { firmId } }),
    retry: false,
  });

  const fetchSummary = useServerFn(getFirmPlanSummary);
  const summaryQ = useQuery({
    queryKey: ["firm-plan-summary", firmId],
    queryFn: () => fetchSummary({ data: { firmId } }),
    staleTime: 5 * 60_000,
  });
  const summary = summaryQ.data;
  const isMulti = !!(summary?.allowsMultiOrg || summary?.supportsConsolidation);

  // Optimistic copy while a default-card toggle is being written.
  const [pendingWidgets, setPendingWidgets] = useState<WidgetKey[] | null>(null);
  const [savingWidgets, setSavingWidgets] = useState(false);
  const selectedWidgets = (pendingWidgets ?? summary?.widgets ?? []) as WidgetKey[];
  const saveFirmDefaults = useServerFn(saveFirmDefaultWidgets);
  const toggleWidget = async (w: WidgetKey) => {
    if (savingWidgets) return;
    const on = selectedWidgets.includes(w);
    const next = on ? selectedWidgets.filter((x) => x !== w) : [...selectedWidgets, w];
    setPendingWidgets(next);
    setSavingWidgets(true);
    try {
      await saveFirmDefaults({ data: { firmId, widgets: next } });
      await qc.invalidateQueries({ queryKey: ["firm-plan-summary", firmId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client-widgets"] });
      setPendingWidgets(null);
      toast.success(
        on
          ? `${WIDGET_LABEL[w] ?? w} turned off for every client`
          : `${WIDGET_LABEL[w] ?? w} turned on for new clients`,
      );
    } catch (e: any) {
      setPendingWidgets(null);
      toast.error(e?.message ?? "Could not save default cards");
    } finally {
      setSavingWidgets(false);
    }
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["firm-subscription", firmId] });
    qc.invalidateQueries({ queryKey: ["my-firm", firmId] });
    qc.invalidateQueries({ queryKey: ["firm-plan-summary", firmId] });
    qc.invalidateQueries({ queryKey: ["my-firms"] });
  };


  if (q.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to this organisation&apos;s settings.
        </p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
          Back to organisations
        </Button>
      </main>
    );
  }

  const view = q.data;
  const planV = firmPlanView({
    tier: view.subscription.tier,
    status: view.subscription.status,
    is_always_free: view.firm.isAlwaysFree,
    trial_ends_at: view.subscription.trialEndsAt,
    current_period_end: view.subscription.currentPeriodEnd,
  });
  const endLabel = fmtDate(view.subscription.currentPeriodEnd);
  const pendingCancel = view.subscription.cancelAtPeriodEnd;
  const canManage = view.canManage;

  const doChange = async (planKey: string) => {
    setBusy(planKey);
    try {
      await changePlan({ data: { firmId, planKey } });
      await refresh();
      toast.success("Plan updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change the plan");
    } finally {
      setBusy(null);
      setConfirmPlan(null);
    }
  };

  const doCancel = async (cancel: boolean) => {
    setBusy("cancel");
    try {
      await setCancel({ data: { firmId, cancel } });
      await refresh();
      toast.success(cancel ? "Subscription set to cancel" : "Subscription resumed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update the subscription");
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const target = view.plans.find((p) => p.key === confirmPlan);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/firms/$firmId" params={{ firmId }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {view.firm.name}
        </Link>
      </Button>

      <h1 className="font-display text-3xl font-semibold">Organisation settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage the plan and subscription for {view.firm.name}.
      </p>

      {/* Current plan */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CreditCard className="h-4 w-4 text-muted-foreground" /> Plan &amp; subscription
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{planV.planLabel}</Badge>
          <Badge variant="outline" className={toneClasses(planV.statusTone)}>
            {planV.statusLabel}
          </Badge>
          <span className="tabular-nums text-muted-foreground">
            {view.clientCount} of {view.clientLimit} clients used
          </span>
          {planV.dueLabel && <span className="text-muted-foreground">· {planV.dueLabel}</span>}
        </div>

        {pendingCancel && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Cancellation scheduled{endLabel ? ` — access until ${endLabel}` : ""}.
            </span>
            {canManage && (
              <Button size="sm" variant="outline" disabled={busy === "cancel"} onClick={() => doCancel(false)}>
                {busy === "cancel" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Resume subscription
              </Button>
            )}
          </div>
        )}

        {!canManage && (
          <p className="mt-4 text-xs text-muted-foreground">
            Only the organisation owner can change or cancel this subscription.
          </p>
        )}
      </section>

      {/* What's included + default cards */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium">What&apos;s included</h2>
        {summaryQ.isLoading && (
          <p className="mt-2 text-xs text-muted-foreground">
            <Loader2 className="mr-2 inline h-3 w-3 animate-spin" /> Loading plan details…
          </p>
        )}
        {summary && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>
                Clients allowed:{" "}
                <strong className="text-foreground tabular-nums">{view.clientLimit}</strong>
              </span>
              <span>
                Xero files allowed:{" "}
                <strong className="text-foreground tabular-nums">
                  {summary.xeroFileLimit ?? view.clientLimit}
                </strong>
              </span>
              <span>
                Consolidation:{" "}
                <strong className="text-foreground">
                  {summary.supportsConsolidation
                    ? `up to ${summary.consolidationLimit ?? view.clientLimit} Xero files`
                    : "not included"}
                </strong>
              </span>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Dashboard tiers included
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.tiers.length === 0 && (
                  <span className="text-xs text-muted-foreground">None configured</span>
                )}
                {summary.tiers.map((t) => (
                  <Badge key={t.key} variant="secondary" className="text-[11px]">
                    {t.label}
                    {t.allowsMultiOrg ? ` · ${t.xeroFiles} Xero files` : ""}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cards included by default
              </p>
              {isMulti ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(summary.availableWidgets ?? summary.widgets).map((w) => {
                    const on = selectedWidgets.includes(w as WidgetKey);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => toggleWidget(w as WidgetKey)}
                        disabled={savingWidgets}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          on
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground line-through"
                        }`}
                      >
                        {WIDGET_LABEL[w as WidgetKey] ?? w}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.widgets.map((w) => (
                    <span
                      key={w}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {WIDGET_LABEL[w as WidgetKey] ?? w}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {isMulti && savingWidgets && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {isMulti
                ? "Click a card to turn it off for every client in this organisation — changes save straight away. New clients start with the selected cards, and each client's own settings can still turn cards off individually."
                : "New clients start with these cards. Open a client's settings to turn individual cards on or off for them."}
            </p>
          </div>
        )}
      </section>

      {/* Add clients */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium">Add clients</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {view.clientCount} of {view.clientLimit} clients used.
          {view.clientCount >= view.clientLimit
            ? " Client limit reached — upgrade the plan to add more."
            : " Connect a Xero file or set up a client manually."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AddClientFromXeroButton firmId={firmId} disabled={view.clientCount >= view.clientLimit} />
          <Button
            variant="outline"
            asChild={view.clientCount < view.clientLimit}
            disabled={view.clientCount >= view.clientLimit}
          >
            {view.clientCount >= view.clientLimit ? (
              <span>
                <Plus className="mr-2 h-4 w-4" /> New client
              </span>
            ) : (
              <Link to="/clients/new" search={{ firmId } as any}>
                <Plus className="mr-2 h-4 w-4" /> New client
              </Link>
            )}
          </Button>
        </div>
      </section>

      {/* Support access */}
      <div className="mt-6">
        <SupportAccessCard firmId={firmId} />
      </div>

      {view.isSuperAdmin && (
        <div className="mt-6">
          <Link
            to="/admin/firms/$firmId"
            params={{ firmId }}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View audit log (Super Admin) <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}



      {/* Change plan */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium">Change plan</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick the plan that suits this organisation. Changes apply straight away.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {view.plans.map((p) => {
            const current = p.key === view.subscription.tier;
            const tooSmall = view.clientCount > p.clientLimit;
            return (
              <div
                key={p.key}
                className={`rounded-xl border p-4 ${current ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {p.label}
                      {current && (
                        <Badge variant="secondary" className="text-[10px]">
                          Current
                        </Badge>
                      )}
                      {p.isFree && (
                        <Badge variant="outline" className="text-[10px]">
                          Free
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                  {current && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </div>

                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>
                    Clients: <strong className="text-foreground tabular-nums">{p.clientLimit}</strong>
                  </li>
                  <li>
                    Xero files:{" "}
                    <strong className="text-foreground tabular-nums">{p.xeroOrgLimit}</strong>
                  </li>
                  <li>
                    Consolidation:{" "}
                    <strong className="text-foreground">
                      {p.allowsMultiOrg ? "included" : "not included"}
                    </strong>
                  </li>
                  {p.allowedTiers.length > 0 && (
                    <li>Dashboard tiers: {p.allowedTiers.join(", ")}</li>
                  )}
                </ul>

                {canManage && !current && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    disabled={tooSmall || busy != null}
                    onClick={() => setConfirmPlan(p.key)}
                  >
                    {busy === p.key ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    {tooSmall ? `Too small for ${view.clientCount} clients` : `Switch to ${p.label}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Cancel */}
      {canManage && !view.firm.isAlwaysFree && !pendingCancel && view.subscription.tier && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-medium">Cancel subscription</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {endLabel
              ? `Your organisation keeps access until ${endLabel}, then the subscription ends.`
              : "The subscription ends immediately."}
          </p>
          <Button
            size="sm"
            variant="destructive"
            className="mt-3"
            disabled={busy != null}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel subscription
          </Button>
        </section>
      )}

      <AlertDialog open={!!confirmPlan} onOpenChange={(o) => !o && setConfirmPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {target?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This organisation will move onto {target?.label} straight away, allowing{" "}
              {target?.clientLimit} clients.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current plan</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPlan && doChange(confirmPlan)}>
              Switch plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {endLabel
                ? `You'll keep access until ${endLabel}. You can resume any time before then.`
                : "Access ends immediately. You can resume from this page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction onClick={() => doCancel(true)}>Cancel subscription</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
