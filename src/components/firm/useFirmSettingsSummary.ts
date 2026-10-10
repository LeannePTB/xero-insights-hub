import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFirmSettingsSummary } from "@/lib/firm-subscription.functions";

/** Presentation-only summary; every action re-checks on the server. */
export function useFirmSettingsSummary(firmId: string) {
  const fetchSub = useServerFn(getFirmSettingsSummary);
  return useQuery({
    queryKey: ["firm-subscription", firmId],
    queryFn: () => fetchSub({ data: { firmId } }),
    retry: false,
  });
}
