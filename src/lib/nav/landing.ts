/**
 * Where to open after sign-in. Pure routing decision from server signals;
 * every destination keeps its own server-side check.
 */
export type LandingInput = {
  isPlatformStaff: boolean;
  isPracticeMember: boolean;
  firmIds: string[];
  firmClientCounts?: Record<string, number>;
  viewerClientIds: string[];
};

export type Landing =
  | { to: "/system" }
  | { to: "/overview" }
  | { to: "/firms/$firmId"; firmId: string }
  | { to: "/firms/$firmId/overview"; firmId: string }
  | { to: "/clients/$clientId"; clientId: string }
  | { to: "chooser" }
  | { to: "none" };

export function landingFor(i: LandingInput): Landing {
  if (i.isPlatformStaff) return { to: "/system" };
  if (i.firmIds.length > 1) return { to: "/overview" };
  if (i.firmIds.length === 1) {
    const firmId = i.firmIds[0];
    if ((i.firmClientCounts?.[firmId] ?? 1) === 0) return { to: "/firms/$firmId", firmId };
    return { to: "/firms/$firmId/overview", firmId };
  }
  if (i.viewerClientIds.length === 1) return { to: "/clients/$clientId", clientId: i.viewerClientIds[0] };
  if (i.viewerClientIds.length > 1) return { to: "chooser" };
  return { to: "none" };
}
