import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlanLevels, type PlanLevel, type PlanScope } from "@/lib/plan-levels.functions";

/** Subscription levels sourced from the database catalogue (super-admin editable). */
export function usePlanLevels(scope?: PlanScope) {
  const fetchLevels = useServerFn(listPlanLevels);
  const q = useQuery({ queryKey: ["plan-levels"], queryFn: () => fetchLevels() });
  const all: PlanLevel[] = q.data?.levels ?? [];
  const levels = scope ? all.filter((l) => l.scope === scope) : all;
  return { ...q, levels, all };
}

export function labelForLevel(levels: PlanLevel[], key: string | null | undefined, fallback = "No plan") {
  if (!key) return fallback;
  return levels.find((l) => l.key === key)?.label ?? key;
}
