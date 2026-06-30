// Pure rule functions that take already-fetched Xero payloads and return
// findings. No network I/O so they're easy to test and compose.
import { xeroDeepLink } from "./deeplinks";

export type Severity = "high" | "medium" | "low";
export type Category = "coa" | "bank" | "ar_ap" | "tax";

export type Finding = {
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  deepLink: string | null;
  evidence: Record<string, unknown>;
  findingKey: string;
};

function key(ruleId: string, parts: Array<string | null | undefined>): string {
  return `${ruleId}:${parts.filter(Boolean).join("|") || "global"}`;
}

type XAccount = {
  AccountID: string;
  Name: string;
  Code?: string;
  Type?: string;
  Class?: string;
  Status?: string;
  TaxType?: string;
  BankAccountNumber?: string;
  EnablePaymentsToAccount?: boolean;
  CurrentBalance?: number;
};

type XInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type: "ACCREC" | "ACCPAY";
  Status: string;
  DueDate?: string;
  Date?: string;
  AmountDue: number;
  AmountCredited?: number;
  Total?: number;
  Contact?: { ContactID?: string; Name?: string };
};

type XCreditNote = {
  CreditNoteID: string;
  CreditNoteNumber?: string;
  Type: "ACCRECCREDIT" | "ACCPAYCREDIT";
  Status: string;
  RemainingCredit?: number;
  Total?: number;
  Contact?: { ContactID?: string; Name?: string };
};

function parseXeroDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- Chart of accounts ----------
export function ruleCoaHygiene(accounts: XAccount[], shortCode?: string | null): Finding[] {
  const out: Finding[] = [];

  // Duplicate names within same Type+Class
  const byName = new Map<string, XAccount[]>();
  for (const a of accounts) {
    if ((a.Status ?? "ACTIVE") !== "ACTIVE") continue;
    const k = `${(a.Type ?? "").toUpperCase()}|${a.Name.trim().toLowerCase()}`;
    const list = byName.get(k) ?? [];
    list.push(a);
    byName.set(k, list);
  }
  for (const [, list] of byName) {
    if (list.length > 1) {
      out.push({
        ruleId: "coa.duplicate_name",
        category: "coa",
        severity: "medium",
        title: "Duplicate account name",
        message: `${list.length} accounts share the name "${list[0].Name}" (type ${list[0].Type ?? "?"}). Consider merging.`,
        entityType: "Account",
        entityId: list[0].AccountID,
        deepLink: xeroDeepLink("Account", list[0].AccountID, shortCode),
        evidence: { codes: list.map((a) => a.Code ?? a.AccountID) },
        findingKey: key("coa.duplicate_name", [list[0].Name.toLowerCase(), list[0].Type]),
      });
    }
  }

  // Suspense / clearing accounts with non-zero balance
  const suspectNames = /suspense|clearing|unallocated|ask my accountant|holding/i;
  for (const a of accounts) {
    if ((a.Status ?? "ACTIVE") !== "ACTIVE") continue;
    if (!suspectNames.test(a.Name)) continue;
    const bal = Number(a.CurrentBalance ?? 0);
    if (Math.abs(bal) >= 1) {
      out.push({
        ruleId: "coa.suspense_balance",
        category: "coa",
        severity: "high",
        title: "Suspense / clearing account has a balance",
        message: `"${a.Name}" has a balance of ${bal.toFixed(2)}. These accounts should normally clear to zero.`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { balance: bal, code: a.Code },
        findingKey: key("coa.suspense_balance", [a.AccountID]),
      });
    }
  }

  // Revenue / expense without tax rate (or BAS Excluded on revenue)
  for (const a of accounts) {
    if ((a.Status ?? "ACTIVE") !== "ACTIVE") continue;
    const type = (a.Type ?? "").toUpperCase();
    const isRev = ["REVENUE", "SALES", "OTHERINCOME"].includes(type);
    const isExp = ["EXPENSE", "OVERHEADS", "DIRECTCOSTS"].includes(type);
    if (!isRev && !isExp) continue;
    const tax = (a.TaxType ?? "").toUpperCase();
    if (!tax) {
      out.push({
        ruleId: "coa.no_tax_rate",
        category: "coa",
        severity: "low",
        title: "Account has no default tax rate",
        message: `"${a.Name}" has no default tax rate set. Transactions can be coded inconsistently.`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { code: a.Code, type: a.Type },
        findingKey: key("coa.no_tax_rate", [a.AccountID]),
      });
      continue;
    }
    if (isRev && /EXEMPTEXPENSES|INPUT|GSTONCAPITAL|GSTONIMPORTS/.test(tax)) {
      out.push({
        ruleId: "coa.wrong_tax_direction_income",
        category: "tax",
        severity: "high",
        title: "Income account using an expense tax rate",
        message: `"${a.Name}" is income but its default tax rate is "${a.TaxType}". This will misreport GST on the BAS.`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { taxType: a.TaxType },
        findingKey: key("coa.wrong_tax_direction_income", [a.AccountID]),
      });
    }
    if (isExp && /OUTPUT|EXEMPTOUTPUT|BASEXCLUDED.*INCOME/.test(tax)) {
      out.push({
        ruleId: "coa.wrong_tax_direction_expense",
        category: "tax",
        severity: "high",
        title: "Expense account using an income tax rate",
        message: `"${a.Name}" is an expense but its default tax rate is "${a.TaxType}".`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { taxType: a.TaxType },
        findingKey: key("coa.wrong_tax_direction_expense", [a.AccountID]),
      });
    }
    if (isRev && /BASEXCLUDED|NONE/.test(tax)) {
      out.push({
        ruleId: "coa.income_bas_excluded",
        category: "tax",
        severity: "medium",
        title: "Income coded as BAS Excluded / No GST",
        message: `"${a.Name}" defaults to "${a.TaxType}". Confirm this income should be outside the BAS.`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { taxType: a.TaxType },
        findingKey: key("coa.income_bas_excluded", [a.AccountID]),
      });
    }
  }

  // Archived accounts with balance
  for (const a of accounts) {
    if ((a.Status ?? "").toUpperCase() !== "ARCHIVED") continue;
    const bal = Number(a.CurrentBalance ?? 0);
    if (Math.abs(bal) >= 1) {
      out.push({
        ruleId: "coa.archived_with_balance",
        category: "coa",
        severity: "medium",
        title: "Archived account still holds a balance",
        message: `"${a.Name}" is archived but has a balance of ${bal.toFixed(2)}.`,
        entityType: "Account",
        entityId: a.AccountID,
        deepLink: xeroDeepLink("Account", a.AccountID, shortCode),
        evidence: { balance: bal },
        findingKey: key("coa.archived_with_balance", [a.AccountID]),
      });
    }
  }

  return out;
}

// ---------- AR / AP ----------
export function ruleArAp(
  invoices: XInvoice[],
  creditNotes: XCreditNote[],
  shortCode?: string | null,
): Finding[] {
  const out: Finding[] = [];
  const now = Date.now();

  // Negative AR / AP, very old open invoices, duplicate numbers per contact
  const dupCheck = new Map<string, XInvoice[]>();
  for (const inv of invoices) {
    const status = (inv.Status ?? "").toUpperCase();
    if (status === "DELETED" || status === "VOIDED") continue;
    const amt = Number(inv.AmountDue ?? 0);

    if (amt < -0.01) {
      const isAr = inv.Type === "ACCREC";
      out.push({
        ruleId: isAr ? "ar.negative_balance" : "ap.negative_balance",
        category: "ar_ap",
        severity: "medium",
        title: isAr ? "Negative debtor balance" : "Negative creditor balance",
        message: `${inv.Contact?.Name ?? "Contact"} ${isAr ? "AR" : "AP"} ${inv.InvoiceNumber ?? inv.InvoiceID} sits at ${amt.toFixed(2)}. Possibly an unallocated credit.`,
        entityType: isAr ? "Invoice" : "Bill",
        entityId: inv.InvoiceID,
        deepLink: xeroDeepLink(isAr ? "Invoice" : "Bill", inv.InvoiceID, shortCode),
        evidence: { amountDue: amt, contact: inv.Contact?.Name },
        findingKey: key(isAr ? "ar.negative_balance" : "ap.negative_balance", [inv.InvoiceID]),
      });
    }

    if (amt > 0.01 && (status === "AUTHORISED" || status === "SUBMITTED")) {
      const due = parseXeroDate(inv.DueDate) ?? parseXeroDate(inv.Date);
      if (due) {
        const days = Math.floor((now - due.getTime()) / 86_400_000);
        if (days > 120) {
          const isAr = inv.Type === "ACCREC";
          out.push({
            ruleId: isAr ? "ar.over_120" : "ap.over_120",
            category: "ar_ap",
            severity: "medium",
            title: isAr ? "Invoice unpaid for 120+ days" : "Bill unpaid for 120+ days",
            message: `${inv.Contact?.Name ?? "Contact"} ${inv.InvoiceNumber ?? inv.InvoiceID} is ${days} days overdue (${amt.toFixed(2)}).`,
            entityType: isAr ? "Invoice" : "Bill",
            entityId: inv.InvoiceID,
            deepLink: xeroDeepLink(isAr ? "Invoice" : "Bill", inv.InvoiceID, shortCode),
            evidence: { daysOverdue: days, amountDue: amt },
            findingKey: key(isAr ? "ar.over_120" : "ap.over_120", [inv.InvoiceID]),
          });
        }
      }
    }

    if (inv.InvoiceNumber && inv.Contact?.ContactID) {
      const k = `${inv.Type}|${inv.Contact.ContactID}|${inv.InvoiceNumber.trim().toLowerCase()}`;
      const list = dupCheck.get(k) ?? [];
      list.push(inv);
      dupCheck.set(k, list);
    }
  }
  for (const [, list] of dupCheck) {
    if (list.length > 1) {
      const sample = list[0];
      out.push({
        ruleId: "ar_ap.duplicate_number",
        category: "ar_ap",
        severity: "low",
        title: "Duplicate invoice number for a contact",
        message: `${sample.Contact?.Name ?? "Contact"} has ${list.length} ${sample.Type === "ACCREC" ? "invoices" : "bills"} numbered "${sample.InvoiceNumber}".`,
        entityType: sample.Type === "ACCREC" ? "Invoice" : "Bill",
        entityId: sample.InvoiceID,
        deepLink: xeroDeepLink(sample.Type === "ACCREC" ? "Invoice" : "Bill", sample.InvoiceID, shortCode),
        evidence: { count: list.length, ids: list.map((i) => i.InvoiceID) },
        findingKey: key("ar_ap.duplicate_number", [sample.Contact?.ContactID, sample.InvoiceNumber]),
      });
    }
  }

  // Unallocated credit notes
  for (const cn of creditNotes) {
    const status = (cn.Status ?? "").toUpperCase();
    if (status === "DELETED" || status === "VOIDED") continue;
    const remaining = Number(cn.RemainingCredit ?? 0);
    if (remaining > 0.01) {
      out.push({
        ruleId: "ar_ap.unallocated_credit_note",
        category: "ar_ap",
        severity: "low",
        title: "Unallocated credit note",
        message: `${cn.Contact?.Name ?? "Contact"} has ${remaining.toFixed(2)} on credit note ${cn.CreditNoteNumber ?? cn.CreditNoteID}. Allocate it against an open invoice.`,
        entityType: "CreditNote",
        entityId: cn.CreditNoteID,
        deepLink: xeroDeepLink("CreditNote", cn.CreditNoteID, shortCode),
        evidence: { remaining },
        findingKey: key("ar_ap.unallocated_credit_note", [cn.CreditNoteID]),
      });
    }
  }

  return out;
}

// ---------- Bank ----------
export function ruleBank(accounts: XAccount[], shortCode?: string | null): Finding[] {
  const out: Finding[] = [];
  const banks = accounts.filter((a) => (a.Type ?? "").toUpperCase() === "BANK" && (a.Status ?? "ACTIVE") === "ACTIVE");
  for (const b of banks) {
    const bal = Number(b.CurrentBalance ?? 0);
    if (bal < -0.01) {
      out.push({
        ruleId: "bank.negative_balance",
        category: "bank",
        severity: "high",
        title: "Bank account is in overdraft",
        message: `"${b.Name}" has a negative balance of ${bal.toFixed(2)}.`,
        entityType: "Account",
        entityId: b.AccountID,
        deepLink: xeroDeepLink("Account", b.AccountID, shortCode),
        evidence: { balance: bal },
        findingKey: key("bank.negative_balance", [b.AccountID]),
      });
    }
  }
  return out;
}
