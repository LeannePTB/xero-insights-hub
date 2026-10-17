# Batch 2 (17 Oct) — plan

Classification: SECURITY-RELEVANT (catalogue status / entitlement, new audited System Admin saves, suppression-list delete, sidebar visibility). No access widening anywhere.

## 1. Client overview table
- White card and body rows; very light tint on header row only.
- Table scrolls sideways inside the card, with the Client column sticky. Long tax/super cells wrap, so nothing gets cut off.
- Bank note becomes one muted line ("$2,639 unreconciled"), with the full sentence in a tooltip.

## 2. Retire Bookkeeping checks
- Migration: set `xero_audit` and `transaction_search` to status `retired` (same as Notes). Client ticks, tables and stored audit results stay as they are. No code deleted.
- `client_cards_v2` already drops retired cards, so the existing card gates make readers refuse for every role, System Admin included. Also add an explicit refusal to the audit and transaction-search server functions.
- Remove from: dashboard, module heading, Package/Default ticks, Upgrade, locked tiles, Roadmap, website copy, report sections, Trixie tools/prompts/help, menu, System Admin audit entry points.
- Dependency sweep (Overview "Partial data", Health signals, file-health warnings, setup checklist): remove each use or make it independent. Every one is listed in the report.
- Packages & modules: a collapsed "Retired" list, System Admin only.

## 3. Coming soon → Roadmap
- Display wording only. Table and function names stay the same.

## 4. Editable Roadmap
- New override table `coming_soon_overrides`, keyed by card/module, holding name, description and expected (free text). RLS on, grants revoked, read only through the existing readers.
- `admin_save_coming_soon_override`: AAL2, super admin, audited.
- Hand-written entries gain an "Expected" field (the existing timing column, relabelled).
- Every row gets up/down sort order, Show, Show on website, and Remove (hand-written) or Hide (automatic).
- "Expected: …" shows on the dashboard, Upgrade page and website.
- Report which Cash flow card is Work in progress, and whether that's intended.

## 5. White surfaces
- Tokens: `--card`, `--popover` and `--input` set to white. Table rows use card, not muted.
- Sweep boxes that use bg-muted, bg-secondary or bg-slate.
- Add the rule to AGENTS.md.
- Spot check desktop and mobile, and list the pages changed.

## 6. Bounced alert email
- New server functions, AAL2 and System Admin, via an audited definer:
  - read suppression status for the configured alert address only
  - unblock that one address
- Warning plus Unblock button next to the alert address. Send test stays.
- Enquiries page shows "Email blocked (address bounced)".
- Nothing is unblocked automatically.

## 7. Main contact email
- New `main_contact_email` column on platform branding. Saved through the existing audited AAL2 save and exposed by `get_platform_branding()`. Set to hello@tractionadvisory.com.au.
- Replace hard-coded contact addresses on: website, help text, auth pages, platform email footers and Reply-To, Trixie hand-off, Upgrade.
- Practice-sent client reports keep the practice's reply-to.
- Security and legal contact details are listed, not changed.

## 8. Dashboard heading
- Hide the "Standard" heading and its rule.
- The subtitle lists only the modules actually shown.

## 9. Sidebar
- Remove the "Organisation" and "Client" labels.
- "← Back to <organisation>": shown only when `getMyContext` says the caller can open that organisation.
- "← All organisations": shown when the caller can see more than one.
- Both are presentation signals only. Mobile menu is the same.

## Checks
tsgo, build, vitest tests/, bun test src, security:check, linter, backlog/register/matrix updates.

Tests:
- retired cards hidden and refused for all roles, System Admin included
- ticks survive
- reports and Trixie don't mention the retired cards
- Roadmap override save needs a super admin with AAL2
- unblock removes only the alert address

## Owner decisions assumed (correct me)
- Retiring is reversible: setting status back to Available restores the ticks.
- Unblock removes only the configured alert address, never any other.
