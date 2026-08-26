// Page one of the Monthly Management Report.
//
// The same rules engine that drives the staff badge, run against data fetched
// LIVE for this report. This module never reads `xero_snapshots`: a finalised
// report pins its own figures, so it must not be assembled from a cache.
//
// Two live inputs are needed and only one is a new call:
//   - the Balance Sheet as at the period end (one Xero call)
//   - the open debtor book as at the period end, reused from the as-at
//     subledger the report already reconstructs for the receivables ageing.
//
// Every string this module produces is frozen into the payload by the caller.

import type { AsAtEntry } from "@/lib/xero/asat-ledger.server";
import type { ReportVerdict, ReportVerdictFinding } from "./monthly-report";
import { NON_ADVICE_LINE } from "./monthly-report";
import { evaluateFromRows, type SnapshotRow, type Verdict } from "@/lib/health/rules.server";
import { dedupeGapSentences } from "./coverage-gaps";

type Conn = Parameters<typeof import("@/lib/xero/api.server").xeroGet>[0];

/**
 * Build a snapshot-shaped row from a live fetch. `payload_version` and
 * `fetched_at` are placeholders that the engine is told to ignore via
 * `skipFreshness` rather than faked to look fresh.
 */
function liveRow(reportKey: string, asAt: string, payload: any, complete: boolean): SnapshotRow {
  return {
    report_key: reportKey,
    payload,
    payload_version: -1,
    as_at: asAt,
    fetched_at: new Date().toISOString(),
    complete,
  };
}

/** Debtor entries in the shape the debtors rule reads (open invoices). */
function entriesAsInvoices(entries: AsAtEntry[]) {
  return entries
    .filter((e) => e.kind === "invoice" && e.amount > 0)
    .map((e) => ({
      AmountDue: e.amount,
      DueDate: e.dueDate ?? e.date,
      Contact: { Name: e.contact },
    }));
}

// ---------------------------------------------------------------------------
// Repetition
// ---------------------------------------------------------------------------

export type PriorVerdictReport = {
  periodEnd: string;
  /** Null when that report carried no verdict block (written before v11). */
  ruleIds: string[] | null;
};

/**
 * How often this rule has been raised before.
 *
 * Only FINALISED reports count — a draft is not something the client has seen.
 * A month whose report carried no verdict block is "not previously assessed";
 * it is never counted as the rule not firing, and a gap is never bridged.
 */
export function repetitionSentence(
  ruleId: string,
  priors: PriorVerdictReport[],
): string | null {
  const assessed = priors.filter((p) => p.ruleIds !== null);
  if (!assessed.length) return null;

  // Consecutive run of assessed reports, most recent first, that raised it.
  let streak = 0;
  for (const p of assessed) {
    if (p.ruleIds!.includes(ruleId)) streak += 1;
    else break;
  }
  const raised = assessed.filter((p) => p.ruleIds!.includes(ruleId)).length;
  const window = assessed.length;

  if (streak === 0 && raised === 0) {
    return `This was not raised in the ${window === 1 ? "previous report" : `previous ${window} reports`}.`;
  }
  // An unbroken run is the finding: say so plainly.
  if (streak === raised && streak === window) {
    return `This has been raised in every one of the last ${window} reports, including this one.`;
  }
  if (streak > 1) {
    return `This has now been raised in ${streak} consecutive reports, and in ${raised} of the last ${window}.`;
  }
  return `This was also raised in ${raised} of the last ${window} reports.`;
}

// ---------------------------------------------------------------------------
// Page-one copy
// ---------------------------------------------------------------------------

const COVERAGE_ALL =
  "Every check in this review was completed against the accounting records for the period.";

function coverageSentence(gaps: string[]): string {
  // De-duplicated by cause, not by rule: two rules blocked by the same missing
  // input become one sentence. See @/lib/reports/coverage-gaps.
  const merged = dedupeGapSentences(gaps);
  if (!merged.length) return COVERAGE_ALL;
  const joined = merged.join(" ");
  return `Some parts of this review could not be completed from the records available for the period. ${joined}`;
}

/** Points to a conversation. Never a decision, never a deadline. */
function nextStepFor(state: Verdict["state"]): string | null {
  if (state === "issues") {
    return "We are available to talk this through with you when it suits.";
  }
  if (state === "partial" || state === "disconnected" || state === "no_data" || state === "stale") {
    return "We are available to talk through what is needed to complete this review.";
  }
  return null;
}

export function composeVerdict(
  verdict: Verdict,
  priors: PriorVerdictReport[],
  comment: { body: string; author: string; createdAt: string } | null,
): ReportVerdict {
  const gaps = (verdict as { gaps?: string[] }).gaps ?? [];

  const findings: ReportVerdictFinding[] =
    verdict.state === "issues"
      ? verdict.findings.map((f) => ({
          ruleId: f.ruleId,
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          repetition: repetitionSentence(f.ruleId, priors),
        }))
      : [];

  const headline =
    verdict.state === "issues"
      ? findings[0]!.title
      : verdict.state === "ok"
        ? verdict.label
        : verdict.state === "disconnected"
          ? "This review could not be completed"
          : verdict.state === "no_data" || verdict.state === "stale"
            ? "This review could not be completed"
            : "This review was completed in part";

  const detail =
    verdict.state === "issues"
      ? [findings[0]!.detail, findings[0]!.repetition].filter(Boolean).join(" ")
      : verdict.state === "no_data" || verdict.state === "stale"
        ? // The engine's own wording for these states talks about snapshots and
          // overnight refreshes, which is staff language. A delivered document
          // states the position plainly instead.
          "The accounting records needed for this review could not be read when this report was prepared."
        : verdict.detail;

  return {
    state:
      verdict.state === "issues" ||
      verdict.state === "ok" ||
      verdict.state === "disconnected" ||
      verdict.state === "no_data"
        ? verdict.state
        : "partial",
    headline,
    detail,
    findings,
    coverage:
      verdict.state === "disconnected"
        ? "The Xero connection was not available when this report was prepared, so no part of this review could be completed."
        : coverageSentence(gaps),
    nextStep: nextStepFor(verdict.state),
    comment,
    nonAdvice: NON_ADVICE_LINE,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type BuildVerdictOptions = {
  conn: Conn;
  supabase: any;
  clientId: string;
  tenantId: string;
  connectionStatus: string;
  periodEnd: string;
  /** Reused from the receivables ageing — no extra Xero call. */
  debtorEntries: AsAtEntry[] | null;
  /** False when the debtor book could not be read in full. */
  debtorsComplete: boolean;
};

export async function buildReportVerdict(opts: BuildVerdictOptions): Promise<ReportVerdict> {
  const { xeroGet } = await import("@/lib/xero/api.server");

  const rows: SnapshotRow[] = [];

  try {
    const [bs, accounts] = await Promise.all([
      xeroGet<any>(opts.conn, "Reports/BalanceSheet", { date: opts.periodEnd }),
      xeroGet<any>(opts.conn, "Accounts"),
    ]);
    rows.push(liveRow("balance_sheet", opts.periodEnd, bs, true));
    rows.push(liveRow("accounts", opts.periodEnd, accounts, true));
  } catch {
    // Left out entirely: the engine reports the missing check as a coverage
    // gap, which is what page one must say.
  }

  if (opts.debtorEntries) {
    rows.push(
      liveRow(
        "invoices_accrec_open",
        opts.periodEnd,
        { Invoices: entriesAsInvoices(opts.debtorEntries) },
        opts.debtorsComplete,
      ),
    );
  }

  const verdict = evaluateFromRows(
    {
      clientId: opts.clientId,
      connections: [{ tenantId: opts.tenantId, status: opts.connectionStatus }],
      snapshots: rows,
      now: new Date(),
    },
    { skipFreshness: true },
  );

  const priors = await loadPriorVerdicts(opts.supabase, opts.clientId, opts.periodEnd);
  const comment = await loadMonthComment(opts.supabase, opts.clientId, opts.periodEnd);
  return composeVerdict(verdict, priors, comment);
}

/** Prior FINALISED reports for this client, most recent first. */
export async function loadPriorVerdicts(
  supabase: any,
  clientId: string,
  periodEnd: string,
  limit = 6,
): Promise<PriorVerdictReport[]> {
  const { data, error } = await supabase
    .from("client_reports")
    .select("period_end, payload, status")
    .eq("client_id", clientId)
    .lt("period_end", periodEnd)
    .in("status", ["final", "sent"])
    .order("period_end", { ascending: false })
    .limit(limit);
  if (error) return [];

  return (data ?? []).map((r: any) => {
    const v = r.payload?.verdict;
    return {
      periodEnd: r.period_end,
      ruleIds: v ? ((v.findings ?? []) as any[]).map((f) => f.ruleId) : null,
    };
  });
}

/**
 * The bookkeeper's line: the most recent note marked for the report that was
 * written during the report's own month. Absent is normal — the block is then
 * omitted entirely and finalising is never blocked.
 */
export async function loadMonthComment(
  supabase: any,
  clientId: string,
  periodEnd: string,
): Promise<{ body: string; author: string; createdAt: string } | null> {
  const monthStart = `${periodEnd.slice(0, 7)}-01`;
  const { data, error } = await supabase
    .from("client_notes")
    .select("body, author_id, created_at")
    .eq("client_id", clientId)
    .eq("include_in_report", true)
    .gte("created_at", `${monthStart}T00:00:00Z`)
    .lte("created_at", `${periodEnd}T23:59:59Z`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;

  const row = data[0];
  let author = "Positive Traction";
  if (row.author_id) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", row.author_id)
      .maybeSingle();
    author = profile?.display_name ?? profile?.email ?? author;
  }
  return { body: row.body, author, createdAt: row.created_at };
}
