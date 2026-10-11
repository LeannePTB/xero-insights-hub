import { z } from "zod";

export type ClientAccessRelationship = "business_owner" | "external_adviser";

export const optionalInviterLabelSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z
    .string()
    .min(1)
    .max(80, "Name must be 80 characters or fewer.")
    .refine(
      (value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Name must not be an email address.",
    )
    .nullable(),
);

export function relationshipLabel(value: ClientAccessRelationship | null | undefined) {
  if (value === "business_owner") return "Business Owner";
  if (value === "external_adviser") return "Viewer";
  return "Not set";
}

/**
 * User-facing login-type names. Database keys (super_admin, practice_team,
 * firm_members.role owner|staff, client_access.relationship) are unchanged.
 */
export const LOGIN_TYPE_LABEL = {
  super_admin: "System Administrator",
  practice_team: "Traction Advisory team",
  owner: "Organisation Owner",
  staff: "Staff",
  viewer: "Viewer",
  business_owner: "Business Owner",
  support: "Support access",
} as const;

export const LOGIN_TYPE_DESCRIPTION = {
  super_admin:
    "Runs the platform: organisations, plans, sign-ups and security. Gives no access to any organisation's or client's data by itself.",
  practice_team:
    "Traction Advisory's own people. Added as Staff to organisations Traction Advisory looks after.",
  owner: "Runs the organisation: its team, Viewers, clients and settings.",
  staff: "Works on every client in the organisation.",
  viewer:
    "Read-only. Sees All clients (including clients added later) or only Selected clients. Never changes anything.",
  business_owner: "Runs their own business's account for one client only.",
  support: "A temporary, read-only pass approved by the Organisation Owner. Not a login type.",
} as const;

export function viewerScopeLabel(scope: "all_clients" | "selected", count?: number) {
  if (scope === "all_clients") return "Viewer · All clients";
  return `Viewer · ${count ?? 0} client${count === 1 ? "" : "s"}`;
}
