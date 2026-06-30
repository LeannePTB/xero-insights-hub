import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessHealthDetail } from "@/lib/health.functions";
import { PillarCard } from "./PillarCard";
import { MoneyRecommendations } from "./MoneyRecommendations";
import { EfficiencyRecommendations } from "./EfficiencyRecommendations";
import { StabilityRecommendations } from "./StabilityRecommendations";
import { Skeleton } from "@/components/ui/skeleton";

export function HealthPillars({
  tenantId,
  clientId,
  fromDate,
  toDate,
}: {
  tenantId: string;
  clientId?: string;
  fromDate: string;
  toDate: string;
}) {
  const fetchDetail = useServerFn(getBusinessHealthDetail);
  const q = useQuery({
    queryKey: ["business-health-detail", tenantId, clientId, fromDate, toDate],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDetail({ data: { tenantId, clientId, fromDate, toDate } }),
  });

  if (q.isLoading) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[360px] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (q.error) {
    return (
      <p className="mt-4 text-sm text-destructive">
        Couldn't load pillar breakdown: {(q.error as Error).message}
      </p>
    );
  }

  if (!q.data) return null;

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {q.data.pillars.map((p) => {
        const expandable = p.key === "money" || p.key === "efficiency" || p.key === "stability";
        const renderExpanded =
          p.key === "money"
            ? () => <MoneyRecommendations metrics={p.metrics} />
            : p.key === "efficiency"
              ? () => <EfficiencyRecommendations metrics={p.metrics} clientId={clientId} />
              : p.key === "stability"
                ? () => <StabilityRecommendations metrics={p.metrics} />
                : undefined;
        return (
          <PillarCard
            key={p.key}
            pillar={p}
            expandable={expandable}
            renderExpanded={renderExpanded}
          />
        );
      })}
    </div>
  );
}
