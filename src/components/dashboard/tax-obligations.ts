import type { GstResponse } from "@/lib/xero/gst.functions";
import type { PaygWithholdingPosition } from "@/lib/xero/reports.functions";

export function netGstAmount(data: Pick<GstResponse, "gstOnSales" | "gstOnPurchases">) {
  return (data.gstOnSales ?? 0) - (data.gstOnPurchases ?? 0);
}

export function latestCompletedPaygMonth(
  data: PaygWithholdingPosition | undefined,
): { month: string; amount: number } | null {
  if (!data || data.status !== "available") return null;
  const month = data.months.find((item) => !item.incomplete);
  return month ? { month: month.month, amount: month.withheld } : null;
}
