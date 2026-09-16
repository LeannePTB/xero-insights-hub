# Move trials to the organisation

## Classification and current answer

**SECURITY-RELEVANT.** Trials change commercial entitlement and therefore which financial cards people may read. The change must preserve AAL2, database authorisation, tenant isolation, audit evidence, and the rule that `super_admin` alone grants no organisation or client-data access.

With `card_model_v2` active, the per-client trial is **inert for card visibility**:

- The live card gate (`client_visible_cards`, `client_allowed_widgets`, and direct widget access) uses the organisation purchase from `org_subscription_options`, intersected with each client’s stored ticks.
- The v2 availability function does not read `client_subscriptions` or `client_entitlement`; it reads purchased Advisory/Consolidation and the organisation’s lapsed billing state.
- `client_entitlement` still evaluates each old client trial at read time and falls back to Standard after expiry. Remaining legacy display and upgrade code can therefore change labels or recommendations, but it does not remove cards under v2.
- DRTABT Projects currently has purchased Advisory **on**, purchased Consolidation **on**, and an active organisation subscription. Therefore the old client trials ending will not remove its cards.
- Live data contains nine DRTABT client trial rows, but it does **not** contain one uniform date: eight end on **6 December 2026** and `X16 X17 & X18 Enterprises Pty Ltd` ends on **14 October 2026**. Neither expiry currently changes v2 card access.

So, on 6 December, the eight old entitlement rows fall back to Standard metadata on their next read, but DRTABT’s cards remain available from the organisation purchase. This is “something in between”: no card loss, but stale legacy labels/readers can disagree with the real card model until removed from active v2 presentation.

## Proposed organisation trial model

### Storage: purchased and trialled remain separate

Add nullable trial fields to `org_subscription_options` without deleting or repurposing existing fields:

- `trial_advisory_enabled boolean not null default false`
- `trial_consolidation_enabled boolean not null default false`
- `trial_ends_at timestamptz null`

The existing `advisory_enabled` and `consolidation_enabled` remain the purchased facts. Trial fields never overwrite them.

Create one database resolver for effective organisation options:

```text
effective Advisory = purchased Advisory
                  OR (trial Advisory AND trial_ends_at > database now)

effective Consolidation = purchased Consolidation
                       OR (trial Consolidation AND trial_ends_at > database now)
```

The resolver will:

- evaluate expiry on every read; no scheduled expiry job;
- enforce that effective Consolidation requires effective Advisory;
- return purchased, trialled, effective, end date, active/ending-soon state separately;
- cap trial grants to the known purchasable Advisory and Consolidation groups only;
- resolve the organisation from the client in the database, so a caller ID is never a grant;
- retain the existing organisation-lapsed billing check as the final cap.

Update the single v2 card-availability implementation to use the effective resolver. Card visibility remains:

```text
effective organisation options ∩ stored per-client ticks
```

Expiry therefore hides trial-only Advisory/Consolidation cards on the next request while leaving every `client_cards.cards` value untouched. Purchasing later restores each client’s remembered selection.

`client_entitlement` and the old client subscription rows remain unchanged for the v1 rollback path. Active v2 code will no longer use them to describe trials or card state.

## Trial administration, audit, and owner experience

Add one caller-scoped database function for starting, extending, changing, or ending an organisation trial. It will:

- assert AAL2 first;
- require `super_admin` in the database;
- require a non-empty reason;
- verify the organisation exists and update only that organisation;
- reject Consolidation without Advisory;
- reject unknown grant types and invalid/past end dates for starts/extensions;
- write one append-only `audit_log` event with actor, organisation, action time, reason, previous trial fields, new trial fields, and end date—no client or financial data;
- leave purchased fields unchanged unless the separately approved DRTABT migration explicitly reclassifies the existing backfill.

Expose this through the existing organisation purchase editor, not client settings. Show purchased and trialled state as distinct controls/readouts so “what is paid for?” remains answerable.

On the Organisations list:

- show `Trial: Advisory` or `Trial: Advisory + Consolidation` with the exact end date;
- show an amber “ends in N days” warning during the final 14 days;
- distinguish trial-granted options from purchased options rather than simply saying “on”;
- stop showing expired trials as active; retain history in the audit log.

Remove per-client trial controls and trial labels from active v2 screens. Keep the old controls and `set_client_trial` available only when the v1 switch is active, clearly labelled legacy, so rollback remains possible. Do not delete or rewrite `client_subscriptions`.

## Migration and rollback (revised — owner decision 16 September 2026)

**No organisation trial is created for any organisation.** DRTABT Projects is billed with bookkeeping, so its Advisory and Consolidation are granted, not trialled: its purchased flags stay `true` and it is never exposed to a 6 December expiry. Every organisation keeps `trial_ends_at` null, and the trial capability exists for future external customers who have not purchased yet.

Before migration, record and assert:

- all organisation purchase values and per-client tick lists;
- the 56 consolidation account mappings, 9 group members, 1 group, and 1 snapshot;
- current visible-card counts for every client.

Then, in one additive migration:

1. Add the organisation trial fields, all defaulting to no trial.
2. Add the effective-options resolver and the audited trial function.
3. Switch v2 card availability to effective purchased-or-trialled options.
4. Backfill nothing. No purchased flag changes, and the nine legacy per-client trial rows stay untouched and inert.
5. Assert every client's visible-card count and all protected consolidation counts are unchanged immediately after migration.

Because nothing is trialled today, the migration must be behaviour-neutral: `purchased OR (trial AND unexpired)` with no trials equals purchased alone.

Rollback drops back to the previous resolver; the additive columns and legacy client rows remain. The `card_model_v2` switch can still return to v1.

## Legacy trial labels

Remove trial labels from active v2 screens entirely rather than correcting their dates. The client list currently shows "trial · ends 06/12" on all nine DRTABT clients although one legacy row actually ends 14 October; both the date and the concept are wrong under the organisation model. The legacy per-client trial controls remain reachable only when the v1 switch is on.

## Verification and matrix evidence

Add matrix and regression cases proving:

- **an organisation with purchased Advisory and a null or expired trial keeps its cards** — the case that protects DRTABT;
- an authorised member of a trialled organisation sees its trialled Advisory cards;
- trialled Consolidation only with Advisory, in the same organisation, where consolidation is meaningful;
- immediately after database-time expiry, trial-only cards are denied through list reads, direct widget assertions and saved/direct routes;
- per-client ticks are unchanged through start, extension, end and expiry, and restore on later purchase;
- only an AAL2 super admin may start, extend or end a trial; AAL1, staff, support, advisers, business owners, organisation owners and unrelated super admins cannot;
- each accepted change writes exactly one audit row with actor, organisation, reason, before/after state and database time, and no client data;
- direct table writes remain denied and no other organisation is affected.

Run the full security check, live posture, linter, access matrix, typecheck and expiry-boundary tests, then update the specification, registers, backlog and model documentation.

## Plan conclusion

### What a trial does today and what happens on 6 December

The old per-client trials still set `client_entitlement` metadata and legacy labels, but they do not control v2 cards. DRTABT's purchased Advisory and Consolidation keep every eligible card available, so 6 December removes no cards.

### The new shape

Purchased and trialled Advisory/Consolidation stored separately on `org_subscription_options`; effective state resolved as purchased OR unexpired trial at read time; organisation lapse still caps; per-client ticks always preserved.

### The migration

Additive schema and resolver only. No trial backfill, no purchased-flag changes, legacy client rows untouched, and all card and consolidation counts asserted unchanged.

### Owner decisions

1. **DRTABT purchase classification — REJECTED as recommended.** Its Advisory and Consolidation stay purchased; no organisation trial is created anywhere.
2. **Warning window:** approved — amber from 14 days out, exact end date visible from the start.
3. **Maximum duration:** approved — 120 days.
4. **Legacy controls:** approved — hidden while v2 is active, available only in v1 rollback.
