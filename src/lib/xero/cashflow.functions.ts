import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CashflowMonth = {
  label: string; // e.g. "Apr 2026"
  fromDate: string;
  toDate: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
};

export type BankAccountBalance = {
  accountId: string;
  name: string;
  code: string | null;
  currency: string;
  balance: number;
};

export type CashflowProjectionBucket = {
  label: string; // "Next 30 days" | "31–60 days" | "61–90 days"
  inflow: number;
  outflow: number;
  net: number;
  closingCash: number;
};

export type Cashflow = {
  asOf: string;
  // Current position
  totalCash: number;
  currency: string;
  accounts: BankAccountBalance[];
  // Period actuals
  fromDate: string;
  toDate: string;
  totalIn: number;
  totalOut: number;
  netMovement: number;
  months: CashflowMonth[];
  // Forward projection
  overdueReceivables: number;
  overduePayables: number;
  projection: CashflowProjectionBucket[];
};

type XeroAccount = {
  AccountID: string;
  Name: string;
  Code?: string;
  Type?: string;
  Class?: string;
  CurrencyCode?: string;
};

type XeroInvoice = {
  InvoiceID: string;
  Type: "ACCPAY" | "ACCREC";
  Status: string;
  DueDate?: string;
  AmountDue: number;
};

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthsBetween(from: Date, to: Date): Array<{ start: Date; end: Date; label: string }> {
  const months: Array<{ start: Date; end: Date; label: string }> = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= last) {
    const start = new Date(cursor);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    months.push({
      start,
      end,
      label: start.toLocaleString("en-AU", { month: "short", year: "numeric" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// Parse a Xero BankSummary report into { cashReceived, cashSpent } across all bank accounts.
// BankSummary report rows include OpeningBalance, CashReceived, CashSpent, ClosingBalance per account.
function parseBankSummary(report: any): { received: number; spent: number } {
  let received = 0;
  let spent = 0;
  const reports = report?.Reports ?? [];
  for (const r of reports) {
    const rows = r?.Rows ?? [];
    for (const section of rows) {
      const sectionRows = section?.Rows ?? [];
      for (const row of sectionRows) {
        if (row?.RowType !== "Row" && row?.RowType !== "SummaryRow") continue;
        const cells = row?.Cells ?? [];
        // Cells: [Account, OpeningBalance, CashReceived, CashSpent, ClosingBalance]
        if (cells.length >= 5) {
          const cashIn = Number(cells[2]?.Value ?? 0) || 0;
          const cashOut = Number(cells[3]?.Value ?? 0) || 0;
          // Skip total/summary row to avoid double-counting
          if (row?.RowType === "SummaryRow") continue;
          received += cashIn;
          spent += cashOut;
        }
      }
    }
  }
  return { received, spent };
}

export const getCashflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; fromDate: string; toDate: string }) => input)
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "cashflow");
    const conn = await getConnectionByTenant(data.tenantId);

    // 1) Current bank account balances
    const accountsRes = await xeroGet<{ Accounts?: XeroAccount[] }>(conn, "Accounts", {
      where: 'Class=="ASSET"&&Type=="BANK"&&Status=="ACTIVE"',
    });
    const bankAccounts = accountsRes.Accounts ?? [];

    const accounts: BankAccountBalance[] = [];
    for (const acc of bankAccounts) {
      // The Accounts endpoint doesn't return a balance; pull it from BankSummary per account.
      // Simpler: compute by reading BankSummary for a wide window (last 12 months).
      accounts.push({
        accountId: acc.AccountID,
        name: acc.Name,
        code: acc.Code ?? null,
        currency: acc.CurrencyCode ?? "AUD",
        balance: 0,
      });
    }

    // Get closing balances from a BankSummary over the last 12 months.
    const balToDate = new Date();
    const balFromDate = new Date(balToDate.getFullYear(), balToDate.getMonth() - 12, 1);
    let totalCash = 0;
    try {
      const balSummary = await xeroGet<any>(conn, "Reports/BankSummary", {
        fromDate: toISO(balFromDate),
        toDate: toISO(balToDate),
      });
      // Parse closing balances per account from the report.
      const reports = balSummary?.Reports ?? [];
      for (const r of reports) {
        const rows = r?.Rows ?? [];
        for (const section of rows) {
          const sectionRows = section?.Rows ?? [];
          for (const row of sectionRows) {
            if (row?.RowType !== "Row") continue;
            const cells = row?.Cells ?? [];
            if (cells.length >= 5) {
              const accountName = String(cells[0]?.Value ?? "").trim();
              const closing = Number(cells[4]?.Value ?? 0) || 0;
              const match = accounts.find((a) => a.name === accountName);
              if (match) match.balance = closing;
              totalCash += closing;
            }
          }
        }
      }
    } catch {
      // ignore — leave balances at 0
    }

    // 2) Period actuals — break into months for the trend
    const fromD = new Date(data.fromDate);
    const toD = new Date(data.toDate);
    const monthRanges = monthsBetween(fromD, toD);
    const months: CashflowMonth[] = [];
    let totalIn = 0;
    let totalOut = 0;
    for (const m of monthRanges) {
      const mFrom = new Date(Math.max(m.start.getTime(), fromD.getTime()));
      const mTo = new Date(Math.min(m.end.getTime(), toD.getTime()));
      try {
        const summary = await xeroGet<any>(conn, "Reports/BankSummary", {
          fromDate: toISO(mFrom),
          toDate: toISO(mTo),
        });
        const { received, spent } = parseBankSummary(summary);
        const net = received - spent;
        totalIn += received;
        totalOut += spent;
        months.push({
          label: m.label,
          fromDate: toISO(mFrom),
          toDate: toISO(mTo),
          moneyIn: received,
          moneyOut: spent,
          net,
        });
      } catch {
        months.push({
          label: m.label,
          fromDate: toISO(mFrom),
          toDate: toISO(mTo),
          moneyIn: 0,
          moneyOut: 0,
          net: 0,
        });
      }
    }

    // 3) Forward projection — AR / AP by due bucket
    async function fetchOpen(type: "ACCREC" | "ACCPAY"): Promise<XeroInvoice[]> {
      const out: XeroInvoice[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await xeroGet<{ Invoices?: XeroInvoice[] }>(conn, "Invoices", {
          where: `Type=="${type}"&&Status!="PAID"&&Status!="VOIDED"&&Status!="DELETED"&&Status!="DRAFT"`,
          page: String(page),
          order: "DueDate ASC",
        });
        const batch = res.Invoices ?? [];
        out.push(...batch);
        if (batch.length < 100) break;
      }
      return out;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const day = 86_400_000;

    let overdueAR = 0;
    let overdueAP = 0;
    const bucketAR = [0, 0, 0];
    const bucketAP = [0, 0, 0];

    try {
      const [ar, ap] = await Promise.all([fetchOpen("ACCREC"), fetchOpen("ACCPAY")]);
      for (const inv of ar) {
        const amt = Number(inv.AmountDue) || 0;
        if (amt <= 0) continue;
        const due = parseXeroDate(inv.DueDate);
        const days = due ? Math.floor((due.getTime() - todayMs) / day) : 0;
        if (days < 0) {
          overdueAR += amt;
          bucketAR[0] += amt; // treat overdue as next-30
        } else if (days <= 30) bucketAR[0] += amt;
        else if (days <= 60) bucketAR[1] += amt;
        else if (days <= 90) bucketAR[2] += amt;
      }
      for (const inv of ap) {
        const amt = Number(inv.AmountDue) || 0;
        if (amt <= 0) continue;
        const due = parseXeroDate(inv.DueDate);
        const days = due ? Math.floor((due.getTime() - todayMs) / day) : 0;
        if (days < 0) {
          overdueAP += amt;
          bucketAP[0] += amt;
        } else if (days <= 30) bucketAP[0] += amt;
        else if (days <= 60) bucketAP[1] += amt;
        else if (days <= 90) bucketAP[2] += amt;
      }
    } catch {
      // ignore — projection will be zeros
    }

    const labels = ["Next 30 days", "31–60 days", "61–90 days"];
    const projection: CashflowProjectionBucket[] = [];
    let running = totalCash;
    for (let i = 0; i < 3; i++) {
      const inflow = bucketAR[i];
      const outflow = bucketAP[i];
      const net = inflow - outflow;
      running += net;
      projection.push({
        label: labels[i],
        inflow,
        outflow,
        net,
        closingCash: running,
      });
    }

    const result: Cashflow = {
      asOf: toISO(today),
      totalCash,
      currency: accounts[0]?.currency ?? "AUD",
      accounts,
      fromDate: data.fromDate,
      toDate: data.toDate,
      totalIn,
      totalOut,
      netMovement: totalIn - totalOut,
      months,
      overdueReceivables: overdueAR,
      overduePayables: overdueAP,
      projection,
    };
    return result;
  });
