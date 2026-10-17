# Dashboard cards
- Client income tax instalments use one period-history table and audited caller-scoped save; history and organisation-team-only editing stay explicit.
- Modules use `card_modules.sort_order`. Tax tiles use pure `TaxObligationsBody` with unchanged shared figures.
- Wages split uses only the Cost classification Wages marker via pure `src/lib/wages-split.ts`; it is presentation only, so gross/net profit and break-even maths never change.
- Lodged bill/instalment status labels come only from `billStatus` (organisation Perth day) in `tax-obligations.ts`, so card, Overview, report and Trixie never disagree.
- Income tax instalment setting/editing lives in Client settings → Tax & reporting through audited caller-scoped functions; the dashboard tile is read-only.
