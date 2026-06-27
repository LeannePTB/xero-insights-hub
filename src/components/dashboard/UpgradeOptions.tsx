import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUpgradeOptions } from "@/lib/tier-config.functions";
import { TIER_LABEL, TIER_DESCRIPTION, WIDGET_LABEL, type DashboardTier } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function UpgradeOptions({
  clientId,
  clientName,
  currentTier,
}: {
  clientId: string;
  clientName: string;
  currentTier: DashboardTier;
}) {
  const fetchFn = useServerFn(getUpgradeOptions);
  const q = useQuery({
    queryKey: ["upgrade-options", clientId, currentTier],
    queryFn: () => fetchFn({ data: { clientId, currentTier } }),
    staleTime: 5 * 60_000,
  });

  if (!q.data || q.data.upgrades.length === 0) return null;
  const { upgrades, contactEmail } = q.data;

  function handleRequest(tier: DashboardTier) {
    const subject = `Dashboard upgrade request — ${clientName}`;
    const body =
      `Hi,\n\nI'd like to upgrade the ${clientName} dashboard to the ${TIER_LABEL[tier]} tier.\n\n` +
      `Could you let me know the cost and next steps?\n\nThanks.`;
    if (!contactEmail) {
      toast.message("Contact your advisor to request this upgrade.", {
        description: `Ask for the ${TIER_LABEL[tier]} dashboard for ${clientName}.`,
      });
      return;
    }
    const href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  return (
    <section className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Other dashboards available</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        You're currently on the <strong>{TIER_LABEL[currentTier]}</strong> dashboard. These
        higher tiers unlock extra widgets — request an upgrade from your advisor.
      </p>
      <div className="space-y-3">
        {upgrades.map((u) => (
          <div
            key={u.tier}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold">{TIER_LABEL[u.tier]}</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{TIER_DESCRIPTION[u.tier]}</p>
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Adds
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {u.extraWidgets.map((w) => (
                    <span
                      key={w}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {WIDGET_LABEL[w]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleRequest(u.tier)} className="shrink-0">
              Request upgrade <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
