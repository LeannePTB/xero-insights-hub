## Plan

1. **Separate “Wages” from the fixed/variable/excluded break-even choice**
   - Change Cost Classification so an account can stay **Fixed** for break-even while also being marked as **Wages** for Business Health.
   - This answers your concern: tagging wages will **not** move them out of fixed costs unless you explicitly change the break-even classification.

2. **Fix the Efficiency pillar reading tagged wages**
   - Update Business Health detail to read the new wage flag and include both Operating Expenses and Cost of Sales lines when calculating “Wages as % of rev”.
   - Also make the date range from the Business Health picker apply to the pillar breakdown so the card and detail section are looking at the same period.

3. **Migrate existing data safely**
   - Add a dedicated wage marker in the backend.
   - Convert any existing accounts currently tagged as `wages` into: `classification = fixed` plus `is_wages = true`, so existing tags keep working and do not upset break-even.

4. **Update cache refresh**
   - After saving classifications, invalidate both break-even and business-health queries so the Efficiency card updates immediately instead of staying on “Not tagged”.

## Technical notes

- Current issue: `wages` is stored in the same field as `fixed/variable/excluded`, so Business Health can look for it, but break-even treats unknown/non-variable/non-excluded values as fixed. It works accidentally for break-even, but it is not clear or robust.
- Safer model: keep `classification` only for break-even and add `is_wages` only for Business Health Efficiency.