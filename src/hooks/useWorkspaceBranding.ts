import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getClientWorkspaceBranding, getFirmWorkspaceBranding } from "@/lib/branding.functions";
import { usePlatformBranding, type PlatformBranding } from "@/hooks/usePlatformBranding";

export type EffectiveWorkspaceBranding = PlatformBranding & {
  whiteLabelEnabled: boolean;
  firmId: string | null;
};

/** URL chooses the workspace only; guarded database functions decide access and entitlement. */
export function useWorkspaceBranding(): EffectiveWorkspaceBranding {
  const platform = usePlatformBranding();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const firmId = /^\/firms\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const clientId = /^\/clients\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const getFirm = useServerFn(getFirmWorkspaceBranding);
  const getClient = useServerFn(getClientWorkspaceBranding);
  const q = useQuery({
    queryKey: ["workspace-branding", firmId ?? "", clientId ?? ""],
    enabled: !!firmId || (!!clientId && clientId !== "new"),
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: () => firmId
      ? getFirm({ data: { firmId } })
      : getClient({ data: { clientId: clientId ?? "" } }),
  });
  const resolved = q.data;
  if (!resolved?.whiteLabelEnabled) return { ...platform, whiteLabelEnabled: false, firmId: null };
  return {
    ...platform,
    productName: resolved.organisationName,
    logoLight: resolved.logoUrl ?? platform.logoLight,
    logoDark: resolved.logoUrl ?? platform.logoDark,
    whiteLabelEnabled: true,
    firmId: resolved.firmId,
  };
}