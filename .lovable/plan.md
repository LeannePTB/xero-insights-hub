# Traction Advisory charts

## Recommendation

Use **one small, shared vector-chart system**: pure TypeScript calculates axes, points, bars and labels; the app renders that geometry as accessible SVG, and monthly PDFs draw the same geometry directly with the existing jsPDF vector commands. No new chart dependency, browser canvas, screenshot service or SVG-to-image conversion.

This suits the requested line, area, grouped-bar and break-even charts, stays fast, and produces crisp server-rendered PDFs. It avoids maintaining one browser chart library and a different PDF chart engine.

**Security classification: SECURITY-RELEVANT** because the work touches client financial readers, card displays and report generation. It does not change who can read or write data. Preserve AAL2, caller-scoped database access, card entitlements, private report downloads and immutable final/sent documents.

## Verified constraints

- `getClientOverview` uses `overview_clients()` and caller-scoped stored-data reads. Its current history query covers 40 days and its sparkline exposes 30 days.
- A live metadata-only query found **six distinct snapshot dates, from 8–14 October 2026** in `client_key_figures`. There is not six months of history today. Client-specific availability can be shorter; public UI must derive coverage only from the caller's allowed rows.
- Retention documentation says **no limit has been decided** for key figures; 13 months is a requirement for year-on-year comparisons, not a confirmed enforced retention guarantee.
- `getCashflow` is already a live Xero reader, not a stored-history reader. Charts will reuse its existing response without extra calls or changing its default date range. Its projection contains **three 30-day closing-cash buckets**, not 90 daily observations.
- `useBreakevenData` already loads its P&L and classification/account inputs. Reuse the mounted card's result; do not mount another fetching hook for the chart.
- The report builder's current implementation produces month, prior-month and FY-to-date columns, plus prior-FY comparison. An older comment mentions 12 monthly periods, but the implementation **does not supply a ready-made 12-month series**. Stored report payloads contain monthly net profit, not a cash trend.
- Key figures are unique per **client + Xero file + date**. Aggregation must resolve the existing client's file scope and consolidate once per client/day, not treat rows as distinct clients or mix currencies.

## Proposed views

### 1. Overview totals row

**Source:** the visible client set returned by `overview_clients()` for the current organisation or All organisations, and the same assessed figures that populate the Overview rows. Add numeric protected-money data to the existing response rather than parsing tooltip text.

**Display:** three unframed summary figures: Total cash at bank, Total tax & super owed, Active clients. Cash uses selected-bank balances, never net cash. Tax/super sums `max(protected_money, 0)` **after each client's shared refund/sign calculation**; a refund for one client must not cancel another client's liability.

**Comparison:** cash and tax/super show dollar and percentage changes against the same calendar day of the previous month, using the same currently visible client cohort. If that day does not exist, use that month's last day. Do not silently substitute a nearby date. A zero baseline shows dollar change but no percentage. Explain cohort/coverage alongside comparisons.

**Important limitation:** key figures do not record historical active-client status or membership/visibility history. Recommend Active clients = the number returned by the current Overview reader, explicitly meaning clients included in this Overview. Its last-month change stays **“— / historical client count unavailable”**; counting old snapshot rows would not prove how many clients were active. True historical active-client comparisons require a separately approved, scoped count-history design, outside this build.

**Empty/accessibility/mobile/performance:** no clients → zero count and unavailable financial totals; missing figures → partial total with coverage, never missing-as-zero. Text figures are the alternative; no colour-only direction. Three columns desktop, stacked mobile. Aggregate once in the existing Overview response, no per-client extra requests.

**Database:** no schema, RLS or grant change. Exact last-month comparisons appear only where stored data exists.

### 2. Overview cash trend, last six months

**Source:** bounded, paginated `client_key_figures` reads within the existing Overview reader, restricted to the RPC-returned client IDs and caller's RLS scope. Retain dates and file identity until consolidation is complete.

**Chart:** straight line with a subtle brand-colour area fill, daily values for short histories and weekly **closing balances**, not summed daily balances, for longer histories. Label the actual range: initially “Cash at bank — available history”, with the available date span; use the six-month title only when supported.

**Empty/insufficient:** no points → no chart; one point → dated balance, no invented line. Missing dates create gaps. Default to complete comparable-cohort points; if partial totals are shown, label coverage explicitly and distinguish them visually. Never connect a change in coverage as a cash movement. No backfill Xero calls. Confirm historical account-selection behaviour; mark changes in configuration rather than quietly rewriting old snapshots.

**Accessibility/mobile/performance:** concise text trend summary and expandable dated totals/coverage table; focusable/tappable points, line/legend labels, non-colour distinctions. Full-width mobile chart with fewer axis labels, same data. At most one six-month fetch per Overview load, paginated beyond the API row cap, at most about 26 weekly display points. Never sum unlike currencies; split totals/series by currency or show an unavailable combined total if currency cannot be established.

**Database:** existing client/date index is suitable for the initial version; no migration or retention change planned.

### 3. Tax & super dollars per client

**Recommendation:** an **extra “Tax & super owed” dollar column** next to Protected money %, rather than tooltip-only. It is easier to scan and exposes the amount when the percentage is unavailable because cash is zero.

**Source:** the exact shared protected-money result used by that row. Positive amount displayed as dollars; genuine net refund shown as “—” with the existing refund explanation, and zero as $0. Keep the per-account breakdown and cash-based percentage rule unchanged.

**Empty/accessibility/mobile/performance:** missing → “—”, not zero. Visible text and keyboard/touch-accessible detail popover; not hover-only. On mobile pair amount and percentage in the existing table/detail presentation. No chart or additional network request.

**Database:** none; narrow numeric response addition only.

### 4. Client Cash flow card

**Source:** `CashflowWidget`'s existing `getCashflow` response: `months[].moneyIn/moneyOut/net`, current cash, and `projection[].closingCash`.

**Charts:** grouped monthly Money in/Money out bars with a net-movement line, using one dollar axis. Below, a separate projection line with labelled points for Now, day 30, day 60 and day 90. Straight segments communicate bucket endpoints; do not manufacture daily forecasts or smooth curves. Keep the existing tables in accessible collapsible sections, including accounts where currently shown.

**Empty/insufficient:** one actual month still supports bars; no data → existing load/error state. Projection is invoice-based, not a full operating-cost forecast: retain its caveat. The reader currently substitutes zero months/buckets after some failed requests; add explicit completeness metadata on those existing fetch outcomes so failed data becomes a gap/unavailable state, not a plausible zero. This is a small reader-correctness change, **not extra Xero calls or a new access rule**.

**Accessibility/mobile/performance:** retain exact-value tables and a text projection summary; distinct series labels, markers and line patterns; touch/keyboard point inspection. Stack charts on mobile, show sparse month labels. Rendering reuses the existing query; no range extension, prefetch, second request or new polling. Colour/status changes do not change thresholds.

**Database:** none. Business Owners receive these charts only where the existing Cash flow card is already authorised and visible.

### 5. Client Break-even card

**Source:** the existing `useBreakevenData` result and shared break-even arithmetic/readiness, on the selected basis and date range.

**Chart:** horizontal revenue bar with a labelled break-even target marker, plus “Above/Below break-even by $… (…%)”. Compare revenue and break-even on the **same period basis**; do not compare partial-period revenue to a full-month target. Percentage = difference ÷ positive break-even target; reuse the existing calculation if equivalent.

**Empty/insufficient:** incomplete classifications/accounts or non-calculable contribution margin → current explanation, no gauge. Zero/non-positive target → no percentage or misleading gauge. Handle negative revenue explicitly with text rather than clipping it to zero.

**Accessibility/mobile/performance:** visible actual/target/difference text and existing detailed figures; target marker and labels work without colour. Full-width mobile bar; no additional fetch/hook. Semantic green/red only for existing healthy/bad meaning, not arbitrary series colours.

**Database:** none. Business Owners see it only through the existing Break-even card entitlement and read boundary.

### 6. Monthly report PDF charts

**Source:** at generation of a **new draft**, collect caller-scoped stored key figures and previous authorised report payloads for that exact client/file scope, dated no later than the report period end. Freeze the chosen chart points, coverage and provenance into a versioned report payload. PDF rendering reads that payload only—never queries Xero or current data.

**Charts:** cash-at-bank month-end line for up to 12 months of available history; net-profit monthly bars with a zero baseline, using stored reports' `profitAndLoss.totals.netProfit` or the existing monthly key figure. Include each month once using deterministic report version precedence; never chart FY-to-date totals or add daily `net_profit_mtd` values. Include the current report month from its newly computed payload without extra calls.

**Empty/insufficient:** missing months remain gaps, not zeros; one point becomes a text figure; no trustworthy history omits the chart with a short coverage note. Do not imply an intra-month snapshot is month-end. Initially the cash chart will have very short/no completed-month history. **No new Xero calls are proposed**; a guaranteed 6–12-month backfill would be a separate approval.

**Accessibility/mobile/performance:** printed chart title, units, readable month labels, direct summary and compact values table; patterns/markers survive greyscale. A4-width sections reserve space before page breaks; verify downloads/readability at mobile size. PDF tables are the practical text alternative; do not claim tagged-PDF accessibility without testing it. At most 12 points/bars per chart; shared vector geometry draws directly into jsPDF, no browser/native rendering dependency.

**Database:** payload-version change only, optional chart fields inside existing JSON; no table/column/policy change. Existing drafts can adopt the new version through the current draft flow. **Never regenerate, replace or mutate an existing final/sent PDF or payload**, including historical reports without a stored PDF; honour their frozen chart-less payload.

### 7. Optional latest monthly report panel

**Source:** caller-scoped report metadata, restricted to the same Overview client cohort and the existing report visibility rules. Default to the newest **sent** monthly report, with period, client, sent date and open action; omit drafts and never expose recipients or unrelated reports.

**Display/empty/accessibility/mobile/performance:** compact unframed row, not a chart. No sent report → hide the panel. Clear link label includes client/period; stack on mobile. Batched metadata read alongside Overview, no PDF preload. Open through the existing client Reports route/private download flow, not a public token or persisted signed URL.

**Database:** none. Optional final phase; it must not offer report visibility to Business Owners or Viewers beyond their existing rights.

## Shared implementation and security details

- Use semantic `chart-1` through `chart-5` mapped to the official light→dark palette **#4EB4EB, #1E90D1, #426CB2, #28468E, #082E5E**. PDF presentation tokens mirror those values. Accessible foreground tokens colour labels; chart-series colours are not assumed to pass text contrast. No orange, amber or gold.
- Pure chart model + web SVG adapter + jsPDF vector adapter; stable aspect ratios, bounded point counts, zero letter spacing and shared in-app type scale. Disable non-essential motion under reduced-motion preferences.
- No new public endpoints, privileged reads, authorisation predicates, roles, RLS or grants. Caller IDs remain filters, tenant/file scope is resolved through existing readers, and charts do not widen card access. Keep financial-read auditing through the existing path, without figures in audit metadata.
- Before implementation, re-read live reader/policy definitions and matrix entries; source catalogue alone is not live proof. Stop if the required data is not available under the existing read rules rather than bypassing them.
- Test concrete rules: positive-only per-client liability aggregation/refunds; selected-bank versus net cash; same-month date/zero-baseline handling; missing dates and coverage; multi-file de-duplication and currencies; monthly versus MTD profit; three-bucket projections; break-even period consistency; stored final/sent immutability. Add cross-organisation and card-denial regression proofs for every expanded reader path.
- Run focused tests, navigation/auth regressions, the full security gate, current posture/linter checks where authorised, and automatic compilation/build. Verify desktop/mobile charts, keyboard/touch alternatives, and a real authorised new-draft PDF end to end. Report blocked authenticated checks honestly. Update architecture rules, roadmap and security backlog during implementation, not during this plan-only turn.

## Order and effort

1. **Shared geometry, tokens and data/completeness checks:** 1–1.5 days.
2. **Overview dollar column, totals and available-history chart:** 1.5–2.5 days.
3. **Cash flow and Break-even cards:** 1.5–2 days.
4. **Frozen report chart payloads and PDF rendering:** 2–3 days.
5. **Cross-role/security tests and desktop/mobile/PDF verification:** 1–1.5 days.
6. **Optional latest-report panel:** 0.5 day.

**Estimate:** 7–10.5 engineering days, plus 0.5 day for the optional panel, excluding historical backfills or access changes. Ship the Overview first, then client cards, then PDFs. Approving this plan accepts truthful available-history displays and an unavailable historical Active-clients comparison, rather than inventing missing data.

**Plan only:** no application or database changes have been made.