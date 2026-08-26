# Verdict page one for the Monthly Management Report

Plan only. Nothing below is implemented.

## 1. What exists now

Files: `src/lib/reports/monthly-report.ts` (types, payload version, formatting), `monthly-report.functions.ts` (server-function wrappers), `monthly-report-context.server.ts` (access + persistence), `monthly-report.server.ts` (the calculation, 815 lines), `report-pdf.server.ts` (jsPDF render + private bucket), `report-delivery.server.ts` (finalise, delete, email, token access), `report-link.functions.ts`, `report-pdf.functions.ts`, `pnl-grouping.ts`, `variance-polarity.ts`. UI: `src/components/reports/MonthlyReportPreview.tsx`, `ReportDeliveryDialogs.tsx`, route `src/routes/_authenticated/clients.$clientId.reports.tsx`, recipient route `src/routes/report.$token.tsx`.

- **Trigger.** Manual only. Staff pick a period end and press generate (`generateMonthlyReport`). There is no cron, no scheduled generation.
- **Scope.** Per **client**, pinned to **one Xero tenant**. `resolveReportContext` resolves the tenant server-side from `client_xero_orgs`; a client with several Xero organisations reports on one of them (`preferTenantId`, validated against the client). Never per Xero file independently of a client.
- **Generation.** `computeMonthlyReport` fetches live from Xero: three sequential `Reports/ProfitAndLoss` calls (month, prior month, FY to date, `standardLayout=false`, memoised on the date pair), `Accounts` once for regrouping, and the as-at subledger for ageing. Notes come from `client_notes` where `include_in_report = true`.
- **Format.** A JSONB payload (`client_reports.payload`, `payload_version` currently **10**) rendered two ways: on screen by `MonthlyReportPreview`, and to PDF by `report-pdf.server.ts` into the private `client-reports` bucket. The PDF is rendered from the stored payload only — no Xero fetch at render time.
- **Sections, in current order:** Notes; Key figures (revenue, expenses, profit after tax, net margin — month, prior month, variance, FY YTD vs prior FY YTD, one sentence each); Profit and Loss (organisation's own layout, month / prior month / variance / FY YTD); Receivables ageing detail; Payables ageing detail; frozen disclaimer. Incomplete generations carry `failedSections` and a banner.
- **Lifecycle.** `draft` → `final` → `sent`. Finalising refuses an older `payload_version` and refuses any failed section, then renders the final PDF once. Drafts of the same version are refreshed in place; otherwise a new version row.
- **Delivery.** Both. Staff download the PDF, and `sendReport` emails per-recipient links: one random token each, only the SHA-256 hash stored in `report_recipients`, expiry default 30 days (max 180), opens counted. A token reaches exactly one report and no other data.

## 2. Page one — structure

Page one sits before Notes and before every number, on screen and in the PDF.

```text
  [ month + client + "Management summary" ]

  1  THE FINDING          one heading + one paragraph, from the ranked verdict
  2  HOW LONG             "This has been the case for N months running."
  3  BOOKKEEPER'S LINE    short comment from Positive Traction staff (optional)
  4  WHAT WE COULD ASSESS one or two sentences, prose, never a badge
  5  NEXT STEP            "We will cover this at your next catch-up."
```

1. **The finding.** The top-ranked `Finding` from `rankFindings` — `title` as the heading, `detail` as the paragraph. Ranking is already consequence-then-days, so the highest-consequence item leads. Below it, remaining findings as a short list (title + detail), no severity colours or chips in the document.
2. **How long.** Per rule id: "Raised in each of the last N reports" / "First raised this month" / "Raised again after not appearing last month". See section 3 for where N comes from.
3. **Bookkeeper's line.** Section 5.
4. **Coverage as a sentence.** The engine already returns `gaps[]` in plain prose ("No GST, PAYG withholding or superannuation account could be matched on the Balance Sheet, so protected money is unknown."). Joined into: "This month we assessed protected money, statutory balances and debtor ageing. Debtor ageing could not be assessed because the open invoice list was incomplete." Diligence phrasing, no apology, no badge.
5. **Nothing fires (`state: "ok"`).** "Nothing in this month's checks required attention. We reviewed protected money against cash at bank, statutory balances and the debtor book." Plus the coverage sentence and the bookkeeper's line if present. Never "you are fine", never a score.
6. **Nothing can be assessed (`no_data` / `disconnected` / `stale` / all gaps).** Page one states what is missing and what will restore it, and the report should not be finalised in that state — the existing finalise guard already blocks incomplete payloads; the verdict section joins that guard as a failed section.

## 3. Month-on-month comparison

`xero_snapshots` is keyed one row per `(client, tenant, report_key, params_hash)` and upserted — latest only, no history. It cannot answer "fourth month running".

`client_reports` **is** the history: one row per client per `period_end` per version, with a frozen JSONB payload. So the answer is: **no new database object is required.** Store the evaluated verdict inside the report payload (new `verdict` block, payload version bump to 11), then compute repetition by reading the prior finalised reports for the same client:

```text
select payload->'verdict' from client_reports
 where client_id = ? and report_key = 'monthly_management'
   and status in ('final','sent') and period_end < ?
 order by period_end desc limit 11
```

Streak = count of consecutive prior months whose verdict lists the same `ruleId`, walking back until a month is missing or does not carry the rule. Gaps in months are gaps in the streak and are worded as such ("raised in 4 of the last 6 reports"), never silently bridged.

Consequences of this choice, stated plainly:
- Repetition only starts accruing from the first report generated after this ships. Earlier months have no verdict block, so wording for them is "not previously assessed" — not "did not fire".
- Drafts are excluded, so regenerating a draft cannot change history.
- A verdict frozen in a finalised report is the record of what was said, which is the correct legal position for a delivered document.

If you later want repetition on the **dashboard** as well (outside report months), that would need stored evaluations — a `client_verdict_evaluations` table — and I would bring that to you for approval separately. Not in this plan.

## 4. Business Health in the report — decision confirmed

Removing the composite score and pillar scores from the report works. Checked:

- `src/lib/health.functions.ts` and the dashboard widget (`HealthWidget.tsx`) are read by the dashboard only. `monthly-report.server.ts` does not import them today — the report never contained the score, so there is nothing to remove and nothing to break. The dashboard widget is untouched by definition.
- The underlying metrics you want kept as evidence (margin, runway, debtor days, working capital) are **not all** in the report payload today. Net margin is (`keyFigures`). Runway, debtor days and working capital are not. Keeping them as "supporting evidence" therefore means adding a small `supporting` block to the payload computed from data the report already fetches plus the Balance Sheet, presented as figures with no score and no rating.
- The one thing to watch: the report and the dashboard would then show the same metrics computed by two code paths. The metric maths should be lifted into one shared pure module both call, so a figure can never disagree between the screen and the delivered document.

## 5. The bookkeeper's sentence

Smallest mechanism, no new table: reuse `client_notes`. It already has `body`, `author_id`, `created_at` and `include_in_report`. Page one takes **the most recent report-marked note authored in the report's own month** and prints it under the generated verdict, attributed to the author and dated. Remaining report-marked notes continue to appear in the existing Notes section, unchanged.

- Nothing new is stored, nothing is migrated, no column added.
- The note is frozen into the payload at generation, like every other figure, so editing it later does not alter a sent report.
- **The report can be generated, finalised and sent without it.** It is never a finalise guard.
- **When absent,** page one simply omits the block — no placeholder, no "no comment provided" line. The generated verdict and the coverage sentence stand alone.
- Trade-off to accept: staff must remember to tick "Include in management report" on that note. The report screen should show, before finalising, whether a comment for this month was found — a quiet line, not a blocker.

## 6. Data source

Confirmed workable, with one change.

`rules.server.ts` is pure over `SnapshotRow[]` — `{ report_key, payload, payload_version, as_at, fetched_at, complete }` — where `payload` is the raw Xero response. Nothing in the rules reads the snapshot table. So the report can build the same shaped rows from its **own live fetch** and pass them straight in.

What changes:
- The report must additionally fetch `Reports/BalanceSheet` as at the period end and the open `ACCREC` invoices as at the period end (the as-at subledger engine already reconstructs this for the receivables section — reuse it rather than adding a Xero call).
- `evaluateClient` currently applies freshness rules — `keyState` returns `stale` when `fetched_at` is older than `STALENESS_SECONDS`, and `payload_version !== SNAPSHOT_PAYLOAD_VERSION` yields `wrong_version`. Live-fetched rows are fresh by construction, but they must not be labelled with the snapshot payload version. The clean fix is a small `evaluateFromRows(rows, { skipFreshness: true })` entry point, or passing `fetched_at = now` and the current version. Do **not** let the report read `xero_snapshots` — a finalised report must pin its own figures.
- Historic periods: the rules evaluate "as at the period end" only if the inputs are as at the period end. The Balance Sheet call takes a date, and the subledger engine already reconstructs open invoices at the period end, so this holds. R05's wording already carries the as-at date.

## 7. Wording constraints

Audited the current strings in `rules.server.ts`. Compliant already:

- No occurrence of "insolvent", "trading while insolvent", "you should", "we recommend", or "advice" anywhere in the rules engine or thresholds.
- R05 carries an explicit carve-out in both code comment and output text: "This is the balance owing only — it says nothing about what has been lodged." Correct, and must survive into the document verbatim.
- Findings are descriptive: "X of GST, PAYG withholding and superannuation is held against Y cash at bank."

Needs rewording for a document rather than a badge:

1. **"Protected money exceeds cash at bank"** (R01 critical) — factual, keep, but the document must not sit it next to any word implying inability to pay. No adjacent framing beyond the figures.
2. **"Debtor book is badly aged"** (R06) — "badly" is a judgement in a badge and reads as criticism in a delivered document. Use "Most of the debtor book is more than 90 days past due" and let the figure do the work.
3. **"Reconnect it before relying on any figure"** (disconnected) — imperative. In a document: "The Xero connection was not available when this report was prepared." Then the standard next-step line.
4. **"No issues found" / "Every check passed"** — "passed" implies an assessment standard the engagement does not offer. Reword as in 2.5 above: what was reviewed, and that nothing required attention.
5. **Next-step line** must point at a conversation, never a decision: "We will cover this at your next catch-up." Never "you should", never a deadline.
6. **Engagement carve-out.** The report must not imply that raising an item transfers responsibility. Add one sentence to page one, adjacent to the coverage sentence: "These observations come from the accounting records and do not constitute a compliance review, or tax, legal or solvency advice." This sits alongside — not replacing — the frozen disclaimer in `disclaimerText()`, which is unchanged.

All wording lives in the rules engine, which currently serves a staff badge. Two consumers with different tolerances means the strings should be split: neutral document wording as the canonical text, with the badge free to abbreviate it.

## 8. Retiring the Standard (`basic`) tier — later, not in this build

Actual data, read now from `client_subscriptions`:

- **No client is on `basic` today.** Tiers in use: `advisory` (1 — Autotek New South Wales Pty Ltd), `multi_company` (12 — all DRTABT Projects), and **2 clients with no subscription row at all**: "Bangkok on King" (Bangkok On Darby) and "Positive Traction" (Positive Traction).
- Those two matter, because `src/lib/entitlement.server.ts` **defaults to `basic`** when no row exists (lines 21 and 44), and `tier-config.functions.ts` falls back to the `basic` catalogue entry twice (lines 236, 648). So `basic` is not just a tier — it is the fallback for absent data.

What they would lose: the `basic` widget set in `src/lib/tiers.ts` — health, receivables, payables, P&L, notes, unreconciled.

To retire it cleanly:
1. Give every client an explicit subscription row so nothing relies on the default.
2. Replace the `basic` default in `entitlement.server.ts` and both fallbacks in `tier-config.functions.ts` with the new free-tier key — the fallback must stay a real tier, never "no tier", or access fails open into an empty dashboard.
3. `tier_settings` has rows only for `advisory` and `basic`; the new free tier needs a row or it has no kill switch.
4. `DashboardTier` is a TypeScript union **and** a database enum (`clients.report_basis` style `USER-DEFINED` types are in use). Removing the enum value is a migration and would need your approval; leaving the value in place and disabling it in `plan_levels` is the safer retirement.
5. `plan_levels.ptb` has `allowed_tiers = {basic}` — that must change before `basic` is disabled, or the default client organisation plan points at a disabled tier.

Note: knowledge item §12.6 still stands — plan `free` has `is_free = false` and `allowed_tiers = {pt}` where `pt` is not a valid `dashboard_tier`, so any cast will throw. That has to be sorted before the free tier becomes the product.

## Approval needed

- No new database objects, no migrations, no RLS changes in this plan.
- `client_reports.payload_version` bumps 10 → 11 (a value change, not a schema change).
