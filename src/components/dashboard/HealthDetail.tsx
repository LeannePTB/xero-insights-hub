import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessHealthDetail } from "@/lib/health.functions";
import { PillarCard } from "./health/PillarCard";
import { Skeleton } from "@/components/ui/skeleton";

export function HealthDetail({ tenantId }: { tenantId?: string }) {
  const fetchDetail = useServerFn(getBusinessHealthDetail);
  const q = useQuery({
    queryKey: ["business-health-detail", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchDetail({ data: { tenantId: tenantId! } }),
  });

  if (!tenantId) return null;

  if (q.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn't load business health detail: {(q.error as Error).message}
      </div>
    );
  }

  if (!q.data) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {q.data.pillars.map((p) => (
        <PillarCard key={p.key} pillar={p} />
      ))}
    </div>
  );
}
