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

## Migration and rollback

Before migration, record and assert:

- all DRTABT purchase, client-trial, and per-client tick values;
- the 56 consolidation account mappings, 9 group members, 1 group, and 1 snapshot;
- current effective and visible-card counts for every DRTABT client.

Then, in one reversible migration:

1. Add the organisation trial fields and effective resolver.
2. Backfill DRTABT Projects with an Advisory + Consolidation organisation trial ending **6 December 2026**, as directed by the owner.
3. Leave all nine per-client trial rows untouched, including the one currently ending 14 October.
4. Switch v2 card reads to effective purchased-or-trialled options.
5. Assert every client’s visible-card count and all protected consolidation counts are unchanged immediately after migration.

The migration needs an explicit commercial classification for DRTABT’s existing `advisory_enabled=true` and `consolidation_enabled=true` values:

- **Recommended:** treat those values as the earlier migration’s representation of the trial, set the purchased flags to false while setting matching trial flags true in the same transaction. Effective access remains unchanged until 6 December; after that, trial-only cards become unavailable as intended.
- **Safer but semantically inert alternative:** leave purchased flags true and add the trial flags. Nothing changes on 6 December because `purchased OR trialled` remains true. This preserves current storage but does not create a meaningful trial.

Because changing purchased flags is a commercial-data correction, implementation will stop unless approval of this plan is taken as approval of the recommended reclassification. No payment, Stripe, invoicing, or pricing work is included.

Rollback restores the previous v2 resolver and DRTABT purchased flags while leaving additive columns and legacy client rows intact. The `card_model_v2` switch can still return to v1.

## Verification and matrix evidence

Add matrix and regression cases proving:

- an authorised member of a trialled organisation sees its trialled Advisory cards;
- trialled Consolidation is available only for the same organisation, with Advisory, and where consolidation is meaningful;
- immediately after database-time expiry, trial-only cards are denied through list reads, direct widget assertions, reports, and saved/direct routes;
- purchased options survive trial expiry;
- per-client ticks are byte-for-byte unchanged through start, extension, end, and expiry, and restore on later purchase;
- no client or other organisation is affected;
- only an AAL2 super admin can start, extend, change, or end a trial; AAL1, staff, support, advisers, business owners, organisation owners, and unrelated super admins cannot;
- each accepted change creates exactly one audit row with actor, organisation, reason, before/after state, and database time;
- direct table writes remain denied;
- v1 behaviour remains available when the switch is off.

Run the full security check, live posture, linter, access matrix, typecheck, and targeted expiry-boundary tests. Update the access-control specification, function register, security backlog, and owner-facing model documentation in the same change.

## Plan conclusion

### What a trial does today and what happens on 6 December

The old per-client trials still change `client_entitlement` metadata and legacy labels, but they do not control v2 cards. Eight DRTABT trials lapse on 6 December; one lapses on 14 October. DRTABT’s purchased Advisory and Consolidation currently keep all eligible cards available, so 6 December will not silently remove cards today.

### The new shape

Store purchased and trialled Advisory/Consolidation separately on `org_subscription_options`; resolve effective state as purchased OR unexpired trial at read time; keep organisation lapse as a cap; preserve per-client ticks when trial-only cards become unavailable.

### The migration

Create one DRTABT organisation trial for Advisory + Consolidation ending 6 December 2026, leave all nine client rows intact, preserve every tick and consolidation record, and assert before/after card counts. Remove client trial controls from active v2 presentation while retaining the legacy path for switch-off rollback.

### Owner decisions with recommendation

1. **DRTABT purchase classification:** recommend reclassifying its current Advisory/Consolidation flags from purchased to trialled in the same transaction; otherwise the new trial will expire without effect.
2. **Warning window:** recommend amber warnings from 14 days before expiry, with the exact date visible from trial start.
3. **Maximum duration:** recommend retaining the existing 120-day maximum unless the owner approves a different commercial limit.
4. **Legacy controls:** recommend hiding them entirely while v2 is active and exposing them only in clearly marked v1 rollback mode.
