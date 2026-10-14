# Charts delivery — 14 October 2026

## Implemented
- Shared pure vector geometry with SVG and jsPDF adapters; semantic brand series and exact-value alternatives. No chart dependency or additional Xero call.
- Overview totals, tax/super dollar column with touch/keyboard detail popover, bounded paginated six-month available-history reads, same-calendar-day prior-month comparison and newest sent monthly report link.
- Existing authorised Cash flow cards: money-in/out bars and net line, closing-cash projection endpoints, collapsible values. Existing fetch failures and capped invoice pagination mark actuals/projection incomplete rather than plotting plausible zeros.
- Existing authorised Break-even cards: monthly revenue/target gauge and dollar/percentage variance. Shared mounted data, no extra hook/read.
- New report drafts: payload version 12 freezes exact-client/file stored month-end cash and authorised monthly profit history. PDF rendering only uses the frozen points. Final/sent historical payloads/PDFs are not changed.

## Truthful limitations
- No six-month backfill. Missing dates/files produce gaps; unknown/mixed currencies suppress combined totals. History retains the settings used when saved; no account-settings history exists to locate configuration changes.
- Current Overview rows are not a multi-file consolidated result: current financial totals are unavailable when the cohort includes a multi-file client, rather than adding ambiguous figures. Historical series consolidates every currently linked readable file once.
- Active clients means current Overview cohort, not historical active status. Last-month client-count comparison is unavailable.
- Exact month-end cash snapshots only; intra-month observations are never labelled month-end. Monthly profit comes from monthly report totals, not summed daily MTD or FY-to-date figures.
- Optional latest report opens the existing client Reports page/private-download flow; no public or persisted signed URL.

## Security report
Classification: SECURITY-RELEVANT financial displays/readers, no access changes.
Invariants: deny-by-default caller RLS; AAL2 retained on existing endpoints; client/file IDs are filters; overview_clients remains sole cohort resolver; super_admin supplies no extra client access; existing card gates remain unchanged; no new admin client, public endpoint, policy, grant, definer function or table. Existing Overview read audit covers the expanded stored history; draft generation uses its existing audited report flow.
Live definitions reviewed: overview_clients, client_key_figures SELECT and AAL2 policies, client_reports staff/viewer and AAL2 policies. No live data rewritten.
Verified this turn: final security:check 248 tests, 2,072 matrix proofs, zero known/unexpected failures, 18 live access checks; 47 focused existing calculation/navigation tests; 22 new chart-rule/reader/PDF tests. Automatic compilation reports build OK. Linter unchanged at 156 issues of three existing types.
security_posture() was refused by tool permissions; no privilege was granted to inspect it.
Desktop/mobile synthetic chart rendering, keyboard point inspection and expandable values checked in Chromium; mobile no horizontal page overflow. Synthetic PDF generated and visually checked with two actual rendered pages, including negative profit bars and value tables.

## Open verification (blocked)
Real authorised Overview/client cards and a newly generated draft/PDF end to end remain blocked by interactive two-step sign-in: restored owner session reaches /auth/mfa-verify, with no page errors. No bypass/reset performed. Synthetic visuals/PDF do not count as the real-client check.
