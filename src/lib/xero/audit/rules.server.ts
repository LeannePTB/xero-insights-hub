// Pure rule functions that take already-fetched Xero payloads and return
// findings. No network I/O so they're easy to test and compose.
import { xeroDeepLink } from "./deeplinks";
import { classifyTaxLine } from "../tax-lines";
import { looksLikeAtoContact } from "../ato-payables";

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
  /**
   * NOT a usable balance source. Measured on a live file: Xero returns
   * CurrentBalance on 0 of 123 accounts from the Accounts endpoint — not even
   * for bank accounts. Rules that need a balance take one from the Balance
   * Sheet report instead (see AccountBalances below).
   */
  CurrentBalance?: number;
};

/**
 * Point-in-time balances by AccountID, read from `Reports/BalanceSheet`.
 *
 * Sign convention is the report's own presentation: a value is positive when
 * the account sits in its natural direction for its section — an asset with
 * money in it is positive, a liability that is owed is positive, and a debit
 * balance on a liability comes back negative. Verified against one live file:
 * the bank account read 7,288.19 on the Balance Sheet and 7,288.19 as a YTD
 * debit on the Trial Balance, while a liability holding a debit balance read
 * -65,379.83 on the Balance Sheet and 65,379.83 as a YTD debit.
 *
 * Balance-sheet accounts only. Revenue and expense accounts never appear, and
 * neither do archived accounts.
 */
export type AccountBalances = Map<string, number>;

/** Balance for an account, or null when the source does not carry one. */
function balanceOf(a: XAccount, balances?: AccountBalances): number | null {
  const v = balances?.get(a.AccountID);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}


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
export function ruleCoaHygiene(
  accounts: XAccount[],
  shortCode?: string | null,
  balances?: AccountBalances,
): Finding[] {
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

  // Suspense / clearing accounts with non-zero balance. The test is on the
  // absolute value, so the Balance Sheet's sign presentation does not matter.
  const suspectNames = /suspense|clearing|unallocated|ask my accountant|holding/i;
  for (const a of accounts) {
    if ((a.Status ?? "ACTIVE") !== "ACTIVE") continue;
    if (!suspectNames.test(a.Name)) continue;
    const bal = balanceOf(a, balances);
    if (bal === null) continue;
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

  // Archived accounts with balance.
  //
  // Left unsourced deliberately: archived accounts appear on neither the
  // Balance Sheet nor the Trial Balance (measured: 25 archived accounts on a
  // live file, 0 rows on either report), and 17 of those 25 are revenue or
  // expense accounts, which no point-in-time report carries. There is no
  // correct balance to give this rule, so it stays inert rather than
  // accusing anyone on an approximation.
  for (const a of accounts) {
    if ((a.Status ?? "").toUpperCase() !== "ARCHIVED") continue;
    const bal = balanceOf(a, balances);
    if (bal === null) continue;
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
export function ruleBank(
  accounts: XAccount[],
  shortCode?: string | null,
  balances?: AccountBalances,
): Finding[] {
  const out: Finding[] = [];
  const banks = accounts.filter((a) => (a.Type ?? "").toUpperCase() === "BANK" && (a.Status ?? "ACTIVE") === "ACTIVE");
  for (const b of banks) {
    // Balance Sheet presentation: an asset in credit reads negative, which is
    // exactly the overdraft this rule tests for. No sign flip is applied.
    const bal = balanceOf(b, balances);
    if (bal === null) continue;
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

// ---------- Payments (possible duplicates) ----------
type XPayment = {
  PaymentID: string;
  Date?: string;
  Amount?: number;
  Reference?: string;
  Status?: string;
  PaymentType?: string;
  Account?: { AccountID?: string; Name?: string; Code?: string };
  Invoice?: {
    InvoiceID?: string;
    InvoiceNumber?: string;
    Type?: "ACCREC" | "ACCPAY";
    Contact?: { ContactID?: string; Name?: string };
  };
  // Present when the payment was made as part of a batch payment. A batch is
  // one act of paying many bills, so repetition inside it is not a duplicate.
  BatchPayment?: { BatchPaymentID?: string } | null;
  BatchPaymentID?: string;
  
};

/** Duplicate-payment window and severity — the only place these are set. */
const DUP_WINDOW_DAYS = 7;
const DUP_WINDOW_MS = DUP_WINDOW_DAYS * 86_400_000;
/** Unallocated payments are a housekeeping matter, not a fact. */
const UNALLOCATED_SEVERITY: Severity = "medium";
/** An overpayment is a fact, not a suspicion. */
const OVERPAY_SEVERITY: Severity = "high";
/** Per-line GST rounding: allow 2c absolute, or 0.5% of the document. */
const OVERPAY_TOLERANCE_CENTS = 0.02;
const OVERPAY_TOLERANCE_RATE = 0.005;
/** Xero accepts up to 100 ids on Invoices?IDs=. */
export const DOC_TOTALS_BATCH = 100;

export type DocTotal = {
  total: number;
  amountPaid: number | null;
  amountCredited: number | null;
  invoiceNumber: string;
  type: string;
};
/**
 * Looks up document totals, e.g. Invoices?IDs=a,b,c. Returns only the ids it
 * could resolve. If it throws, or omits an id, that document is treated as
 * UNKNOWN and nothing is emitted for it — a false accusation of double payment
 * is worse than a missed one.
 */
export type DocTotalsFetcher = (ids: string[]) => Promise<Map<string, DocTotal>>;

export async function rulePayments(
  payments: XPayment[],
  shortCode?: string | null,
  fetchDocTotals?: DocTotalsFetcher,
): Promise<Finding[]> {
  const out: Finding[] = [];

  type Norm = {
    id: string;
    date: Date;
    amount: number;
    accountId: string;
    accountName: string;
    contactId: string;
    contactName: string;
    invoiceId: string;
    invoiceNumber: string;
    invoiceType: string;
    batchId: string;
    type: string;
  };

  const norm: Norm[] = [];
  for (const p of payments) {
    const status = (p.Status ?? "").toUpperCase();
    if (status === "DELETED") continue;
    const d = parseXeroDate(p.Date);
    const amt = Math.round(Number(p.Amount ?? 0) * 100) / 100;
    if (!d || amt <= 0) continue;
    const type = (p.PaymentType ?? "").toUpperCase();
    norm.push({
      id: p.PaymentID,
      date: d,
      amount: amt,
      accountId: p.Account?.AccountID ?? "",
      accountName: p.Account?.Name ?? "",
      contactId: p.Invoice?.Contact?.ContactID ?? "",
      contactName: p.Invoice?.Contact?.Name ?? "Unknown contact",
      invoiceId: p.Invoice?.InvoiceID ?? "",
      invoiceNumber: p.Invoice?.InvoiceNumber ?? "",
      invoiceType: (p.Invoice?.Type ?? "").toUpperCase(),
      batchId: p.BatchPayment?.BatchPaymentID ?? p.BatchPaymentID ?? "",
      type,
    });
  }

  // Prepayments and overpayments are their OWN Xero document types, not
  // invoices. Invoices?IDs= cannot return a total for them, so they can never
  // be tested here — exclude them from the overpayment test outright rather
  // than letting them fall through as "total unavailable".
  const isPrepaidType = (t: string) => t.includes("PREPAYMENT") || t.includes("OVERPAYMENT");

  // Everything ever paid against a document in the fetched window. The
  // overpayment test is about the document, not about one cluster.
  const paidByDoc = new Map<string, number>();
  for (const n of norm) {
    if (!n.invoiceId || isPrepaidType(n.type)) continue;
    paidByDoc.set(n.invoiceId, Math.round(((paidByDoc.get(n.invoiceId) ?? 0) + n.amount) * 100) / 100);
  }

  // Group by contact + amount + bank account.
  const sameAccountGroups = new Map<string, Norm[]>();
  for (const n of norm) {
    if (!n.contactId) continue;
    const sk = `${n.contactId}|${n.amount.toFixed(2)}|${n.accountId}`;
    (sameAccountGroups.get(sk) ?? sameAccountGroups.set(sk, []).get(sk)!).push(n);
  }

  // ---- Pass 1: build the clusters and collect the documents worth pricing ----
  type Candidate = { cluster: Norm[]; docId: string | null };
  const candidates: Candidate[] = [];
  const docIds = new Set<string>();

  const consider = (cluster: Norm[]) => {
    if (cluster.length < 2) return;

    // One batch payment is a single act of paying, not repetition. Kept: the
    // overpayment test does not make it redundant, because a batch can still
    // contain two lines against the same bill.
    const batchIds = new Set(cluster.map((c) => c.batchId));
    if (batchIds.size === 1 && cluster[0].batchId) return;

    const counts = new Map<string, number>();
    for (const c of cluster)
      if (c.invoiceId && !isPrepaidType(c.type))
        counts.set(c.invoiceId, (counts.get(c.invoiceId) ?? 0) + 1);
    const repeatedDoc = [...counts.entries()].find(([, n]) => n >= 2)?.[0] ?? null;
    const noDocument = cluster.every((c) => !c.invoiceId);
    if (!repeatedDoc && !noDocument) return;

    if (repeatedDoc) docIds.add(repeatedDoc);
    candidates.push({ cluster, docId: repeatedDoc });
  };

  for (const [, list] of sameAccountGroups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    let i = 0;
    while (i < sorted.length) {
      const cluster: Norm[] = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length && sorted[j].date.getTime() - cluster[0].date.getTime() <= DUP_WINDOW_MS) {
        cluster.push(sorted[j]);
        j++;
      }
      if (cluster.length >= 2) consider(cluster);
      i = cluster.length >= 2 ? j : i + 1;
    }
  }

  // ---- Pass 2: price those documents, in batches ----
  const totals = new Map<string, DocTotal>();
  if (fetchDocTotals && docIds.size > 0) {
    const ids = [...docIds];
    for (let i = 0; i < ids.length; i += DOC_TOTALS_BATCH) {
      const batch = ids.slice(i, i + DOC_TOTALS_BATCH);
      try {
        const got = await fetchDocTotals(batch);
        for (const [id, t] of got) totals.set(id, t);
      } catch {
        // Totals unavailable for this batch: emit nothing for those documents.
      }
    }
  }

  // ---- Pass 3: emit ----
  const emitted = new Set<string>();

  for (const { cluster, docId } of candidates) {
    const sorted = [...cluster].sort((a, b) => a.date.getTime() - b.date.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = Math.round((last.date.getTime() - first.date.getTime()) / 86_400_000);
    const acctText = first.accountName ? ` from ${first.accountName}` : "";

    let ruleId: string;
    let severity: Severity;
    let title: string;
    let message: string;
    let entityType: string;
    let entityId: string;
    let deepLink: string | null;
    let extraEvidence: Record<string, unknown>;

    if (docId) {
      // A document paid more than once is ordinary instalment trade — rent in
      // parts, a payment plan, a supplier statement paid down. The only fact
      // worth reporting is that the payments EXCEED what the document was for.
      const doc = totals.get(docId);
      if (!doc) continue; // total could not be fetched — say nothing.
      const paid = doc.amountPaid ?? paidByDoc.get(docId) ?? 0;
      const tolerance = Math.max(OVERPAY_TOLERANCE_CENTS, Math.abs(doc.total) * OVERPAY_TOLERANCE_RATE);
      const over = Math.round((paid - doc.total) * 100) / 100;
      if (over <= tolerance) continue;

      const docPayment = sorted.find((s) => s.invoiceId === docId)!;
      const docEntity =
        (doc.type || docPayment.invoiceType) === "ACCREC"
          ? "Invoice"
          : (doc.type || docPayment.invoiceType) === "ACCPAY"
            ? "Bill"
            : null;
      const label = docEntity === "Invoice" ? "invoice" : "bill";
      const number = doc.invoiceNumber || docPayment.invoiceNumber || docId;

      ruleId = "payments.overpaid_document";
      severity = OVERPAY_SEVERITY;
      title = `${docEntity === "Invoice" ? "Invoice" : "Bill"} overpaid — ${first.contactName}`;
      message = `${label.charAt(0).toUpperCase()}${label.slice(1)} ${number} for ${first.contactName} is for ${doc.total.toFixed(2)}, but ${paid.toFixed(2)} has been paid against it${acctText} — ${over.toFixed(2)} more than the ${label} was for. Recover it, or check whether a payment was entered twice.`;
      entityType = docEntity ?? "Invoice";
      entityId = docId;
      deepLink = docEntity ? xeroDeepLink(docEntity, docId, shortCode) : null;
      extraEvidence = {
        case: "overpaid",
        documentTotal: doc.total,
        amountPaid: paid,
        overBy: over,
        amountCredited: doc.amountCredited,
        tolerance: Math.round(tolerance * 100) / 100,
      };
    } else {
      ruleId = "payments.possible_duplicate";
      severity = UNALLOCATED_SEVERITY;
      title = `Unallocated payments — ${first.contactName}`;
      message = `${sorted.length} payments of ${first.amount.toFixed(2)} to ${first.contactName}${acctText} within ${days} day${days === 1 ? "" : "s"} are not allocated to any invoice or bill. Allocate them, or confirm they are on-account payments.`;
      entityType = "Payment";
      entityId = first.id;
      deepLink = null;
      extraEvidence = { case: "unallocated" };
    }

    const fk = key(ruleId, [first.contactId, first.amount.toFixed(2), ...sorted.map((s) => s.id)]);
    if (emitted.has(fk)) continue;
    emitted.add(fk);

    out.push({
      ruleId,
      category: "ar_ap",
      severity,
      title,
      message,
      entityType,
      entityId,
      deepLink,
      evidence: {
        amount: first.amount,
        contact: first.contactName,
        paymentIds: sorted.map((s) => s.id),
        dates: sorted.map((s) => s.date.toISOString().slice(0, 10)),
        accounts: Array.from(new Set(sorted.map((s) => s.accountName).filter(Boolean))),
        invoices: Array.from(new Set(sorted.map((s) => s.invoiceNumber).filter(Boolean))),
        windowDays: days,
        ...extraEvidence,
      },
      findingKey: fk,
    });
  }

  return out;
}


// ---------- Payments (unreconciled) — WITHDRAWN ----------
//
// A rule based on Payment.IsReconciled used to live here. It was withdrawn
// after producing a false backlog twice, for two unrelated structural reasons:
//   1. Batched payments: when a batch is reconciled as one bank line, Xero
//      does not reflect that back onto the individual payments.
//   2. Payments made from non-bank accounts (suspense, cash, loan and
//      prepayment accounts with "enable payments" switched on) have no bank
//      statement lines at all, so IsReconciled can never become true.
// Measured on a live file: all 125 flagged standalone payments sat on non-bank
// accounts, while every one of the 2,595 reconciled payments sat on the single
// BANK account. IsReconciled is a bank-transaction flag, not a payment flag.
// Do not reintroduce a rule on this field.



// ---------- Statutory traceability (A-STAT-TRACE) ----------
//
// Where a file records a lodged activity statement as a bill to the ATO, the
// amount is coded straight to the GST and PAYG withholding accounts, so the
// protected-money figure can be split into "accruing" and "lodged and still
// owing". Where unpaid ATO bills exist but reach no statutory account, that
// split cannot be established — which is a bookkeeping finding in its own
// right, not merely a reporting limitation.
//
// Absence of ATO bills is NOT evidence of a defect: a file that codes payments
// straight to the liability accounts is correct and raises nothing here.
export function ruleStatutoryTrace(
  invoices: XInvoice[],
  accounts: XAccount[],
  shortCode?: string | null,
): Finding[] {
  const statutory = new Set(
    accounts
      .filter((a) => {
        const category = classifyTaxLine(a.Name ?? "", a as any);
        return category === "gst" || category === "payg" || category === "super";
      })
      .map((a) => a.AccountID),
  );

  const atoBills = invoices.filter((inv) => {
    if (inv.Type !== "ACCPAY") return false;
    const status = (inv.Status ?? "").toUpperCase();
    if (status !== "AUTHORISED" && status !== "SUBMITTED") return false;
    if (Number(inv.AmountDue ?? 0) <= 0.01) return false;
    return looksLikeAtoContact(inv.Contact?.Name);
  });
  if (!atoBills.length) return [];

  const traceable = atoBills.filter((inv: any) =>
    (inv.LineItems ?? []).some((li: any) => li?.AccountID && statutory.has(li.AccountID)),
  );
  if (traceable.length > 0) return [];

  const total = atoBills.reduce((s, i) => s + (Number(i.AmountDue) || 0), 0);
  return [
    {
      ruleId: "A-STAT-TRACE",
      category: "tax",
      severity: "medium",
      title: "ATO bills cannot be traced to the statutory accounts",
      message: `There ${atoBills.length === 1 ? "is 1 unpaid bill" : `are ${atoBills.length} unpaid bills`} to the ATO totalling ${total.toFixed(2)}, and none is coded to the GST, PAYG withholding or superannuation accounts. Until the coding is traceable, the amount already lodged and still owing cannot be reconciled against the Balance Sheet.`,
      entityType: null,
      entityId: null,
      deepLink: xeroDeepLink("Bill", atoBills[0].InvoiceID, shortCode),
      evidence: {
        atoBillCount: atoBills.length,
        amountDue: Number(total.toFixed(2)),
        contacts: Array.from(new Set(atoBills.map((b) => b.Contact?.Name).filter(Boolean))),
      },
      findingKey: key("A-STAT-TRACE", ["global"]),
    },
  ];
}
