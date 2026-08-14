# Why "Multi company 5" appears

It is a real dashboard tier row in the catalogue, not a bug in the checkbox list.

There are two multi-company dashboard tiers stored today:

- `multi_company` — labelled "Multi company 5", 5 Xero files (the original built-in tier)
- `multi_10` — labelled "Multi company 10", 10 Xero files (the one you added later and actually use on plans)

The tier picker shows every enabled dashboard tier, so both show up. No client is currently assigned to "Multi company 5", and no organisation plan lists it in its included tiers — only "Multi company 10" is referenced.

## Proposed clean-up

1. Disable the `multi_company` ("Multi company 5") tier so it stops appearing in plan tier pickers and client tier selectors.
2. Rename `multi_10` to plain "Multi company" so there is a single multi-company tier, with the file count driven by the tier's "Xero files per client" setting.
3. Leave the underlying `multi_company` row in place (disabled) so nothing referencing it historically breaks.

## Technical notes

- Both rows live in `plan_levels` with `scope = 'dashboard'`; the change is a data migration setting `enabled = false` on `multi_company` and updating the `multi_10` label.
- `MULTI_ORG_TIER` in `src/lib/tiers.ts` currently hardcodes `multi_company`; multi-org capability is already determined per row by `allows_multi_org`, so any remaining checks against that constant will be switched to the `allows_multi_org` flag so `multi_10` is treated as the multi-org tier.
- No UI layout changes; the tier list simply renders one multi-company option.

If you would rather keep a 5-file step as a sellable tier, say so and I will keep both but rename them consistently instead.
