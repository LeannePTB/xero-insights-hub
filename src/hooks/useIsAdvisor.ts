import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/roles.functions";

/**
 * Presentation-only read of the caller's advisor flag, from the same
 * `getMyContext` signal the client dashboard uses. Never a substitute for a
 * server-side authorisation check — it only decides what to draw.
 */
export function useIsAdvisor(): { isAdvisor: boolean; isLoading: boolean } {
  const fetchCtx = useServerFn(getMyContext);
  const q = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });
  return { isAdvisor: !!q.data?.isAdvisor, isLoading: q.isLoading };
}
