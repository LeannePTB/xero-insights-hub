import type { Pillar } from "@/lib/health.functions";
import { PillarCard } from "./PillarCard";
import { MoneyRecommendations } from "./MoneyRecommendations";
import { EfficiencyRecommendations } from "./EfficiencyRecommendations";
import { StabilityRecommendations } from "./StabilityRecommendations";
import { CashFlowRecommendations } from "./CashFlowRecommendations";

export function HealthPillars({
  pillars,
  clientId,
}: {
  pillars: Pillar[];
  clientId?: string;
}) {
  if (!pillars || pillars.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {pillars.map((p) => {
        const expandable =
          p.key === "money" ||
          p.key === "efficiency" ||
          p.key === "stability" ||
          p.key === "cash_flow";
        const renderExpanded =
          p.key === "money"
            ? () => <MoneyRecommendations metrics={p.metrics} />
            : p.key === "efficiency"
              ? () => <EfficiencyRecommendations metrics={p.metrics} clientId={clientId} />
              : p.key === "stability"
                ? () => <StabilityRecommendations metrics={p.metrics} />
                : p.key === "cash_flow"
                  ? () => <CashFlowRecommendations metrics={p.metrics} />
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
