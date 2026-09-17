import type { Classification, ResolvedClassification } from "@/lib/cost-classification";

export type ClassificationChoice = Classification | "unclassified";

export function classificationChoice(resolved: ResolvedClassification): ClassificationChoice {
  return resolved.unclassified ? "unclassified" : resolved.effective;
}

export function classificationSourceLabel(resolved: ResolvedClassification): string {
  if (resolved.source === "manual") return "Chosen by hand";
  if (resolved.source === "xero") {
    const type = (resolved.xeroType ?? "").trim().toUpperCase();
    const label =
      type === "DIRECTCOSTS"
        ? "cost of sales"
        : type === "OVERHEADS"
          ? "overheads"
          : type.toLowerCase() || "account type";
    return `Seeded from Xero · ${label}`;
  }
  return "No classification saved · treated as fixed";
}
