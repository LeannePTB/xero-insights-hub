// De-duplication of coverage gaps by CAUSE, for the delivered document.
//
// The rules engine reports one gap sentence per rule it could not evaluate.
// Two rules blocked by the same missing input therefore state the same fact
// twice, in slightly different words. On screen that is tolerable; in a
// document sent to a client it reads as careless.
//
// This module is presentation only: it never changes which rules fired, any
// threshold, any severity, any ranking or any figure. It groups gap sentences
// by root cause and emits one sentence per cause, which must still carry
// everything the individual gaps were telling the reader.
//
// Pure — no imports, so both the report builder and any test can use it.

export type GapCause =
  | "statutory_absent"
  | "statutory_unrecognised"
  | "statutory_input_invalid"
  | "partial_statutory_accounts"
  | "balance_sheet_unavailable"
  | "debtors_unavailable";

/**
 * Classify a gap sentence by root cause. Unrecognised sentences return null
 * and are kept verbatim (de-duplicated only against an identical string), so a
 * new rule can never have its explanation silently dropped.
 */
export function classifyGap(gap: string): GapCause | null {
  const g = gap.toLowerCase();

  if (g.includes("no gst, payg withholding or superannuation balances appeared on the balance sheet")) {
    return "statutory_absent";
  }
  if (g.includes("included statutory balance lines that this report could not identify reliably")) {
    return "statutory_unrecognised";
  }
  if (g.includes("available accounting records were not sufficient to determine")) {
    return "statutory_input_invalid";
  }
  if (/could (not )?be matched on the balance sheet/.test(g)) {
    // "Protected money is incomplete: super could not be matched …" — some
    // components resolved, so the cause is a partial mapping, not an absent one.
    if (g.startsWith("protected money is incomplete")) return "partial_statutory_accounts";
    return "statutory_absent";
  }
  if (g.includes("balance sheet snapshot")) return "balance_sheet_unavailable";
  if (g.includes("open invoice")) return "debtors_unavailable";
  return null;
}

/**
 * One sentence per cause. Each names the cause once and states what it means
 * for the review — covering every rule that the cause blocked.
 */
const CAUSE_SENTENCE: Record<GapCause, string> = {
  statutory_absent:
    "No GST, PAYG withholding or superannuation balances appeared on the Balance Sheet for this period, so protected money could not be assessed from that report.",
  statutory_unrecognised:
    "The Balance Sheet included statutory balance lines that this report could not identify reliably, so protected money could not be assessed.",
  statutory_input_invalid:
    "The available accounting records were not sufficient to determine the GST, PAYG withholding and superannuation balances for this period, so protected money was not assessed.",
  partial_statutory_accounts:
    "Some GST, PAYG withholding or superannuation accounts could not be matched on the Balance Sheet, so the money held against cash at bank is understated and the statutory balances are read from the accounts that could be matched.",
  balance_sheet_unavailable:
    "The Balance Sheet for the period could not be read in full, so the money held against cash at bank and the statutory balances carried on the Balance Sheet were not assessed.",
  debtors_unavailable:
    "The list of open customer invoices could not be read in full, so the ageing and concentration of the debtor book were not assessed.",
};

/**
 * Collapse gaps that share a root cause into one sentence each, preserving the
 * order in which the causes first appeared. Gaps with genuinely different
 * causes keep their own sentence.
 */
export function dedupeGapSentences(gaps: string[]): string[] {
  const out: string[] = [];
  const seenCauses = new Set<GapCause>();
  const seenLiterals = new Set<string>();

  for (const gap of gaps) {
    const trimmed = gap.trim();
    if (!trimmed) continue;
    const cause = classifyGap(trimmed);
    if (cause) {
      if (seenCauses.has(cause)) continue;
      seenCauses.add(cause);
      out.push(CAUSE_SENTENCE[cause]);
      continue;
    }
    const key = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (seenLiterals.has(key)) continue;
    seenLiterals.add(key);
    out.push(trimmed);
  }

  // A partial mapping and an absent mapping are the same underlying story; if
  // both somehow appear, the stronger (absent) sentence already says it.
  if (seenCauses.has("statutory_absent") && seenCauses.has("partial_statutory_accounts")) {
    return out.filter((s) => s !== CAUSE_SENTENCE["partial_statutory_accounts"]);
  }
  return out;
}
