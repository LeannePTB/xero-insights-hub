import type { GstResponse } from "@/lib/xero/gst.functions";
import type { PaygWithholdingPosition } from "@/lib/xero/reports.functions";
import type { LodgedAtoBill } from "@/lib/health/health-checks";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Match named monthly/quarterly periods; never assign an unrelated open BAS. */
export function lodgedBillsForPeriod(bills: readonly LodgedAtoBill[], from: string, to: string): LodgedAtoBill[] {
  return bills.filter((bill) => {
    const text = bill.periodText || bill.reference;
    const named = [...text.toLowerCase().matchAll(/\b(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b/g)]
      .map(m => MONTHS.indexOf(m[1].slice(0, 3)) + 1);
    const explicitYear = text.match(/\b(20\d{2})\b/)?.[1];
    const endMonth = named.at(-1);
    const year = explicitYear ?? String(Number(bill.due.slice(0, 4)) - (endMonth && endMonth >= Number(bill.due.slice(5, 7)) ? 1 : 0));
    if (named.length) {
      const start = `${year}-${String(named[0]).padStart(2, "0")}-01`;
      const end = `${year}-${String(endMonth).padStart(2, "0")}-31`;
      return from >= start && to <= end;
    }
    // Undated/unlabelled activity statements cannot be attributed to a month.
    return false;
  });
}

export function paygMonthState(month: { month: string; owing: boolean; incomplete: boolean }, bills: readonly LodgedAtoBill[], complete: boolean) {
  const matched = month.incomplete ? [] : lodgedBillsForPeriod(bills, month.month, month.month);
  if (matched.length) return matched.some(b => b.total !== undefined && b.total > b.amount + 0.005) ? "lodged_part_paid" : "lodged_owing";
  return month.owing ? "owing" : complete ? "paid" : "unknown";
}

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
