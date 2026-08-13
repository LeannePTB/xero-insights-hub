# Rename "Difference" to "Excluded revenue"

On the Cashflow Scenario summary, the third KPI currently reads "Difference" and shows the negative of the revenue removed by the scenario (baseline minus current scenario, GST-exclusive, across the whole period shown).

## Change

- Rename the KPI label to **"Excluded revenue (period)"**.
- Keep the same value and colour behaviour (rose when revenue has been excluded, muted when nothing is excluded).

## Technical detail

- File: `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx`, the `Stat` at the third slot of the summary grid.
- Only the `label` prop changes; `value={fmt(-view.rangeTotals.excludedRevenue)}` and the `tone` logic stay as they are.
