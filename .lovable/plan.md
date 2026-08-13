# Cost basis controls for the Cashflow Scenario

Give each expense group — Cost of sales, Fixed expenses, Variable expenses — its own switch so you can model "if this, then what".

## The three modes (per group)

1. **Actual** — the real Xero figure for the selected month (current behaviour, default).
2. **3-month average** — the trailing 3-month average already calculated and shown as the reference line on each card.
3. **Override** — you type a dollar amount, or nudge the actual by a percentage (e.g. +10%, -15%). The card shows the amount used plus how far it sits from actual.

Each group is independent, so you can hold Cost of sales at actual, run Fixed on the average, and push Variable up 20% at the same time.

## What changes on screen

- A small control row above the summary cards: three segmented toggles (Actual / Avg / Override) labelled Cost of sales, Fixed, Variable, plus a "Reset to actual" link.
- The Cost of sales / Fixed / Variable summary cards show the value in use, with a sub-line stating the basis ("3-mo avg", "Override +10% · actual A$19,968").
- **Net position** and the scenario net figures recalculate from the chosen cost basis, so the revenue exclusions and cost assumptions combine into one scenario.
- The three detailed expense breakdown cards at the bottom keep listing the real Xero accounts, with a note when the group is not on Actual so the line detail is not mistaken for the modelled total.
- Overrides are remembered for the session (same as the month picker) and cleared on sign-out. They are display-only modelling — nothing is written back to Xero or the client's saved settings.

## Technical notes

- All work is client-side in `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx`; no server function or schema change. `avg3` from `getScenarioData` already supplies the average per group.
- New state: `costBasis: { cogs, fixed, variable }` where each entry is `{ mode: "actual" | "avg" | "override", value?: number, pct?: number }`, persisted to `sessionStorage` keyed by client + tenant, following the existing month-picker persistence pattern.
- Add a small `resolveGroupCost(actual, avg, setting)` helper and feed its output into the existing totals so Net position, the expenses cards, and `ScenarioWidget` summary maths stay consistent.
- Cards get a `basisNote` line; the `Stat` component's existing `note` prop carries it.
