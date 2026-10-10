import type { OrgPurchase } from "@/lib/card-model.functions";
import type { OrganisationUsage } from "@/lib/admin-plan-usage.functions";
import type { SubscriptionState } from "@/lib/subscription-state";

export type OrganisationFilter = "all" | "trialling" | "attention" | "overdue";
export type OrganisationSort = "name" | "clients" | "billing" | "trial" | "attention";
export type SortDirection = "asc" | "desc";

export type AdminOrganisation = {
  firm_id: string;
  firm_name: string;
  is_always_free: boolean;
  firm_created_at: string;
  status: string | null;
};

export type AdminOrganisationRow = {
  firm: AdminOrganisation;
  usage?: OrganisationUsage;
  purchase?: OrgPurchase;
  state?: SubscriptionState;
};

export function organisationStatus(row: AdminOrganisationRow) {
  if (row.state?.lapsed) return { label: "Lapsed", tone: "bad" as const };
  if (row.firm.status === "past_due" || row.firm.status === "unpaid") {
    return { label: "Past due", tone: "bad" as const };
  }
  if (row.firm.status === "canceled") return { label: "Cancelled", tone: "bad" as const };
  if (row.firm.status === "paused") return { label: "Suspended", tone: "bad" as const };
  if (row.purchase?.trialActive) return { label: "Trial", tone: "info" as const };
  if (row.firm.is_always_free) return { label: "Always free", tone: "neutral" as const };
  return null;
}

export function organisationNeedsAttention(row: AdminOrganisationRow): number {
  return row.usage?.unsetLodgementCycles ?? 0;
}

export function filterAndSortOrganisations(
  rows: AdminOrganisationRow[],
  search: string,
  filter: OrganisationFilter,
  sort: OrganisationSort,
  direction: SortDirection,
) {
  const query = search.trim().toLocaleLowerCase("en-AU");
  const filtered = rows.filter((row) => {
    if (query && !row.firm.firm_name.toLocaleLowerCase("en-AU").includes(query)) return false;
    if (filter === "trialling" && !row.purchase?.trialActive) return false;
    if (filter === "attention" && organisationNeedsAttention(row) === 0) return false;
    if (filter === "overdue" && !["Lapsed", "Past due"].includes(organisationStatus(row)?.label ?? "")) return false;
    return true;
  });

  const sign = direction === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    let value = 0;
    if (sort === "name") value = a.firm.firm_name.localeCompare(b.firm.firm_name, "en-AU");
    if (sort === "clients") value = (a.usage?.clientsUsed ?? -1) - (b.usage?.clientsUsed ?? -1);
    if (sort === "billing") value = (a.purchase?.billingMode ?? "").localeCompare(b.purchase?.billingMode ?? "");
    if (sort === "trial") value = (a.purchase?.trialEndsAt ?? "").localeCompare(b.purchase?.trialEndsAt ?? "");
    if (sort === "attention") value = organisationNeedsAttention(a) - organisationNeedsAttention(b);
    return value === 0 ? a.firm.firm_name.localeCompare(b.firm.firm_name, "en-AU") : value * sign;
  });
}