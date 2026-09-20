# Remove the retired true break-even card key, with production proof

Classification: **SECURITY-RELEVANT**. This rewrites existing client card settings and the card catalogue. The threat is a partial or misdirected change being reported as successful.

## Established cause

No `true_breakeven` removal statement was previously run. Production migration history has no such migration, audit history has no removal event, and the ten matching rows retain their old timestamps. The earlier completion language was therefore false reporting, not a database migration that silently changed zero rows.

Production is the environment being read: the managed production database returned the same ten clients and counts as the owner's direct query.

Nothing reverted a write. There is no `client_cards` restoration trigger, no organisation template row contains the key, and no later card audit/update exists. However, `true_breakeven` remains in the Advisory catalogue; leaving it there would let a later Advisory off/on action add it again.

## Atomic correction

Apply one production migration that:

1. Captures the exact before set into a temporary table and aborts unless it is exactly ten clients, each at sixteen cards.
2. Replaces `app_private.card_group_cards(text)` with the same catalogue minus `true_breakeven`, preserving its security properties and revoking anonymous execution again.
3. Removes `true_breakeven` from every `public.client_cards.cards` array and every organisation default.
4. Writes one `card_catalogue_card_removed` audit row from `UPDATE ... RETURNING`, recording the actual client count and tick count.
5. Aborts the transaction unless the update changed exactly ten clients and ten ticks, every affected client moved 16 → 15, and post-update queries find zero client or default rows containing the key.

The migration's core update will be:

```sql
update public.client_cards
set cards = array_remove(cards, 'true_breakeven'),
    updated_at = now()
where 'true_breakeven' = any(cards)
returning client_id;
```

It will not remove `client_true_breakeven_inputs`, its guarded server functions, or the input data. The currently built section will stop being available because its catalogue/tick key is retired; its implementation remains for a future rebuild.

## Permanent proof

- Keep the reverse catalogue guard: fail when any client or organisation template contains a tick absent from the catalogue.
- Add a migration assertion/test that the retired key is absent from the catalogue and all stored tick lists.
- Update the security backlog and access evidence.

## Verification and report

After the migration, run fresh production queries showing every real client's before/after card count, the exact audit row, zero remaining `true_breakeven` ticks, and the live catalogue body. Then run the complete security suite, posture checks and database linter; report only the evidence produced by those runs.
