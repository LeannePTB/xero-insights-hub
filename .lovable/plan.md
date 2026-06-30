## Goal
All date pickers default to the **current month** at login, persist while the user is signed in, and reset on logout. Applies to every widget with a date picker, including Business Health.

## Changes

### 1. `src/components/dashboard/DateRangeControls.tsx` — `usePersistedDate`
- Switch storage from `localStorage` to `sessionStorage` so values clear when the browser session ends.
- Also clear on Supabase `SIGNED_OUT` (see step 3) to handle in-tab logout.
- Keep the same `(key, fallback)` API so call sites don't change.

### 2. Default fallbacks → current month
Audit every `usePersistedDate(..., fallback)` call and ensure the fallback returns a current-month value:

- `useBreakevenData.ts` — already `startOfThisMonth` / `endOfThisMonth` ✅ (no change, just verify)
- `HealthWidget` / health pillars date picker — set fallback to start/end of current month
- `CashflowWidget` — set fallback to current month range
- `PnlWidget` — set fallback to current month range
- `TaxLiabilityWidget` "as at" — keep as today (single date, current month implicit)
- `SuperannuationWidget` "as at" — keep as today
- Any other widget using `usePersistedDate` (grep to confirm: Receivables, Payables, Unreconciled, Audit, TransactionSearch, etc.) — normalise to current month range or today for single-date pickers.

Single-date "as at" pickers stay as `new Date()` (today is inside current month). Range pickers all use `startOfThisMonth` → `endOfThisMonth`.

### 3. Clear on logout — `src/routes/__root.tsx`
In the existing `onAuthStateChange` handler, on `SIGNED_OUT` also call `sessionStorage.clear()` (or remove keys with our known prefixes) so the next login starts fresh even if the tab is reused.

### 4. SSR safety
`usePersistedDate` already guards `typeof window === "undefined"`. `sessionStorage` is browser-only, so the same guard covers it.

## Out of scope
- No changes to widget UI, query logic, or business rules.
- No changes to non-date persisted settings (cost classifications, card order, etc.).

## Verification
- Log in → every range picker shows current month (1st → last day).
- Change a picker → navigate to settings and back → value retained.
- Log out → log back in → picker is current month again.
- Open a new tab after closing all tabs → current month.
