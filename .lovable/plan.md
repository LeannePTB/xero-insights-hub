# Standard launch: dashboard charts, monthly report and Advisory enquiries

## Safeguards

**Security-relevant:** stored financial reads, new enquiry records and app emails. Preserve deny-by-default, server-side two-step sign-in, caller-scoped database authorisation, existing card entitlements and metadata-only auditing. System Administrator status never grants client figures. No changes to existing organisation/client access, purchases, Overview or final/sent reports.

## 1. Standard dashboard charts

Use the existing shared SVG/jsPDF chart geometry and brand palette. Place charts inside the existing Standard cards, so Business Owners see them only with the same card permission.

| Card | Chart and source | Missing-data behaviour |
|---|---|---|
| Profit & loss | Twelve-month income/expense bars and net-profit line from stored P&L snapshots, authorised saved reports and backfilled monthly profit. Add current month / last month / same month last year comparisons where available. | Profit-only backfill cannot supply income or expenses: show available profit without inventing bars. Label month-to-date partial; leave unavailable comparisons blank. |
| Business health: cash | Twelve-month cash-at-bank line using the existing caller-scoped merged daily/month-end history. | Show actual coverage and provenance; gaps are missing, not zero. Never substitute net cash. |
| Receivables | Current, 1–30, 31–60, 61–90, 90+ bars from existing ageing calculations over stored invoice data; overdue trend only where dated observations exist. | Clearly distinguish unavailable history from zero overdue. |
| Payables | Same five ageing buckets, using existing payable calculations and stored data. | Same missing-history handling. |
| Business health: score | Keep the ring; add a twelve-month score trend only from stored historical scores. | Do not retrospectively invent scores by applying today's rules to old incomplete data. |

Each chart has exact values in an accessible table, readable labels, mobile sizing and a meaningful empty/single-observation state. Chart loading never triggers extra Xero calls. Existing figure readers remain behind the shared Xero gate.

## 2. Standard monthly report

- New drafts contain the existing key figures, P&L, business health, receivables and payables sections, with profit, cash and ageing charts plus exact-value tables.
- Freeze chart values and provenance into new draft payloads. Honour the existing catalogue-derived section mapping; do not add another entitlement list.
- Browser preview and PDF use the same chart geometry. No Advisory promotion inside client-facing reports.
- Generate an explicitly synthetic **Demo Company (AU)** sample in memory, without saving a draft or touching existing reports. Include PDF and page renders for review. Actual stored Demo Company figures require an authorised two-step-sign-in session; do not use system credentials to bypass that.

## 3. Practice-only Advisory enquiry

- A slim **Unlock Advisory** panel on Standard dashboards and **See what's in Advisory** in Client settings → Package, visible only when a database-resolved capability permits the Organisation Owner or System Administrator. No Staff, Viewer or Business Owner promotion.
- Open an Advisory dialog listing every module/card and its plain-English description from the existing catalogue. Include the configured Calendly **Book a call** button.
- Form: name, verified-email prefill, authorised organisation prefill, interested modules/clients and message. System Administrators without client access do not receive private client options.
- Store in new `upgrade_enquiries`: submitter ownership, bounded fields, validated catalogue choices, status **New / Contacted / Done** and timestamps. The database stamps identity and verifies organisation/client scope; caller IDs never grant access.
- Submitters can read only their own enquiries while still authorised; System Administrators at two-step sign-in can read all enquiry records and update status, but gain no linked client figures. No direct browser writes or deletes.
- System Admin → Enquiries uses the existing guarded admin layout, shared page header and the same database authorisation as its reader/status writer.
- Audit submission and status changes without recording enquiry text or financial values.

### Decisions needed before enquiry implementation

1. **Rate limiting:** there is no standard backend limiter. Approval of this plan authorises a small database-backed, atomic limit for this form: **3 submissions per person per hour**, fail-closed on limiter failure, with duplicate-submission protection. This does not change the Xero gate.
2. **Email:** the app email service permits one notification recipient per triggering event, not a loop over all System Administrators. Send one operational notification to an owner-approved shared inbox, linking to Enquiries; omit the message, client names and financial details. **Please nominate that inbox.** The existing verified sender and unsubscribe behaviour remain unchanged. No promotional email is sent to the enquirer.

The charts, report and enquiry screens can proceed while the notification inbox is outstanding; sending remains explicitly unfinished until supplied.

## Technical implementation and evidence

- Re-read live schema/functions before any migration. New table: revoke defaults, minimum grants, RLS, per-command role policies and restrictive AAL2 guard. New callable functions: fixed search path, AAL2 and caller guard first, deny anonymous execution; Zod validation on client and server.
- Financial history uses caller clients only, bounded date windows/pages and stable per-card query caching. Preserve daily-over-backfill precedence and exact-client/file scope; do not blend currencies or ambiguous multi-file totals.
- Register any new system email use; update the access matrix, definer purposes/register, security backlog, project rules and roadmap.
- Tests: missing months versus zero, partial periods, profit-only history, ageing totals, daily precedence, report freezing and no regeneration; role/cross-organisation/AAL1/direct-write denials; concrete form limit and duplicate submission behaviour.
- Run focused application tests and full `security:check`; inspect automatic compilation/build results (no manual build/typecheck). Attempt live security posture and linter checks and report any unavailable evidence without bypassing it.
- Check desktop/mobile charts and PDF page renders. Verify the authorised enquiry submit → own-row readback → admin status flow when a real AAL2 session is available; otherwise name the MFA blocker rather than claiming completion.

## Delivery order

1. Standard chart data and dashboard presentation.
2. Standard report charts, synthetic sample and page renders.
3. Advisory dialog and enquiry access/storage/admin flow.
4. Single-recipient email after inbox confirmation, then complete security and end-to-end checks.

The owner publishes after reviewing the result; nothing is published automatically.