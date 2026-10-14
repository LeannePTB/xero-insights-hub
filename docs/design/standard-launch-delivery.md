# Standard launch delivery — 14 October 2026

## Delivered
- Card-gated, AAL2 stored-only history reader for P&L, cash and overdue receivables. No additional Xero calls; existing card readers retain their existing behaviour.
- Twelve-month income/expense bars and net-profit line, available current/prior comparisons, partial-month marks and explicit missing figures. Accrual-only saved data is not shown as cash-basis history.
- Standard receivables/payables ageing bars from the existing invoice response. Exact accessible chart values, keyboard point selection and responsive vector layout.
- Cash trend on the Standard health card. Historical health scores are not stored: the card says so rather than inventing a trend.
- New report drafts freeze P&L bars/profit, cash and ageing charts with exact-value tables and existing business health. Historical breakdown gaps remain missing. Old final/sent payloads are not regenerated or changed.
- Catalogue-backed Advisory dialog, database-resolved Organisation Owner/System Administrator eligibility, identity email/organisation, interested modules/authorised clients, bounded message, atomic three-per-hour cap, idempotency and metadata-only audit.
- Submitter-owned enquiry reads recheck eligibility; System Administrator AAL2 list/status controls. No Staff/Viewer/Business Owner prompts or report promotions. Configured Calendly link is reused when present.

## Evidence
- Full security gate initially passed: 261 tests, zero known failures, 18 live access checks. Subsequent added tests prove three/hour cap, duplicate retry and excluded-role context.
- Application regression suite: 217 passed. Synthetic three-page Standard PDF generated and all pages inspected; no real client data.
- Signed-in end-to-end attempted using the requesting user's minted session: `/system/enquiries` correctly stopped at `/auth/mfa-verify`. No MFA bypass or real enquiry submission.
- Linter: 170 findings across the same three categories; the four new authenticated-definer notices correspond to intentionally callable AAL2/authorisation-guarded enquiry functions, not public executability. No new anonymous-definer notice or RLS omission.
- `security_posture()` could not be executed by the read-tool role (permission denied). Do not label posture verified.

## Open before launch
- Owner must complete two-step sign-in for real client dashboard/report and enquiry submit/read/status checks, including mobile. Synthetic PDF is evidence of rendering, not real data correctness.
- Admin email notification is NOT wired: a recipient is not approved and existing mail history includes three failed/dead-letter sends. Enquiries save to the admin list; no success message claims an email was sent. Confirm one notification inbox and resolve mail delivery before wiring a single-recipient alert through the existing sender. No bulk admin-recipient loop.
- Email identity is stamped from `auth.users` and must have a confirmed-email timestamp; unconfirmed callers receive no enquiry context and cannot submit.
- Cash-basis P&L history has no saved cash-basis snapshots; income/expense historical coverage remains limited to saved reports/snapshots. No invented twelve-month history or extra Xero fetch.
- Historical health scores and optional latest-report panel were not added; scores unavailable, panel optional/deferred.

## Security report
New enquiry storage/read/write rules apply only to the new enquiry records, not existing financial rows. AAL2, deny-by-default grants, caller identity, organisation/client scope, immutable final reports and catalogue card entitlement remain enforced. System Administrator eligibility never grants client figures; client options independently require the canonical client-read predicate. Metadata-only platform enquiry access is explicitly classified in isolation tests. Open verification and notification gaps above are blockers, not waived checks.