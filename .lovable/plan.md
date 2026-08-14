# Fix plan wording: clients = Xero files = consolidation capacity

## The problem

The organisation card shows "Clients allowed: 12", "Xero files per client: 10", "Multiple Xero files per client: No". Those three lines contradict each other and don't match the intended rule.

## The rule to enforce

For an organisation plan, the client allowance is the Xero file allowance. If a plan allows 12 clients, the organisation may connect 12 Xero files, and all 12 can be included in a consolidation group. A per-client override (from the subscription's client limit override) moves both numbers together.

## What changes

1. Plan & subscription card (organisation page)
   - Replace the three confusing lines with:
     - "Clients allowed: 12"
     - "Xero files allowed: 12" (organisation-wide, always equal to the client allowance including any override)
     - "Consolidation: up to 12 Xero files" when the plan supports multi-company; otherwise "Consolidation: not included".
   - Remove the "Xero files per client" and "Multiple Xero files per client" lines from this card, since they describe the dashboard tier, not the organisation plan.

2. Plan summary data
   - The organisation plan summary returns the effective client limit (subscription override applied) and derives the Xero file allowance from it, instead of reading a separate stored `xero_org_limit` that can drift out of sync.

3. Organisation connection limit
   - The check that caps how many Xero files an organisation can connect uses the same effective client limit (override applied), rather than the plan row's file field alone. Today an override raises the client limit but not the file limit.

4. Consolidation groups
   - Group capacity is capped at the same effective allowance, so any of the organisation's connected files can be consolidated.

5. Admin plan editor
   - The "Xero files per client" field for organisation-scope plans becomes read-only/derived, shown as "Xero files allowed (matches clients allowed)", so future plans can't be saved with mismatched numbers.

## Not changing

- Dashboard tiers keep their own per-client file setting (a single client consolidating several files); that stays where it belongs, in the tier catalogue and client settings.
- The rule that one Xero file can be linked to only one client at a time.

## Technical notes

- `src/lib/tier-config.functions.ts` (`getFirmPlanSummary`): apply `subscriptions.client_limit_override`, return `xeroFileLimit = effective client limit`, plus a `consolidationLimit`.
- `src/routes/_authenticated/firms.$firmId.tsx`: update the "What's included" line items.
- `src/lib/xero/client-orgs.server.ts` (`getFirmConnectionState`): compute `connectionLimit` from effective client limit.
- `src/lib/consolidation-groups.functions.ts`: expose and enforce the same limit for group membership.
- `src/lib/plan-levels.functions.ts` already forces `xero_org_limit = client_limit` on firm-scope saves; the admin UI field is made derived to match.
- No database migration required.
