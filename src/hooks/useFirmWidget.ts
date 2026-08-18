import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFirmAllowedWidgets } from "@/lib/widget-access.functions";
import type { WidgetKey } from "@/lib/tiers";

/**
 * Organisation-level entitlement, resolved by the database (plan ∩ tier
 * config). Fails closed: while loading or on error, nothing is permitted.
 */
export function useFirmWidgets(firmId: string) {
  const fetchAllowed = useServerFn(getFirmAllowedWidgets);
  const q = useQuery({
    queryKey: ["firm-allowed-widgets", firmId],
    queryFn: () => fetchAllowed({ data: { firmId } }),
    retry: false,
  });
  const widgets = (q.data?.widgets ?? []) as WidgetKey[];
  return {
    widgets,
    isLoading: q.isLoading,
    can: (w: WidgetKey) => !q.isLoading && !q.error && widgets.includes(w),
  };
}
