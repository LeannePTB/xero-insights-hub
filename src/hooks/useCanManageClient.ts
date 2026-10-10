import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyClientCapabilities } from "@/lib/roles.functions";

/**
 * Presentation-only: whether to draw staff controls for this client. Never a
 * substitute for the server-side check every write performs.
 */
export function useCanManageClient(clientId: string | null | undefined): { canManage: boolean; isLoading: boolean } {
  const fetchCaps = useServerFn(getMyClientCapabilities);
  const q = useQuery({
    queryKey: ["client-capabilities", clientId],
    queryFn: () => fetchCaps({ data: { clientId: clientId as string } }),
    enabled: !!clientId,
  });
  return { canManage: !!q.data?.canManageClient, isLoading: !!clientId && q.isLoading };
}
