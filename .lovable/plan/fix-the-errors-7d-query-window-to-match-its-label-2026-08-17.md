Fix the "Errors (7d)" query window to match its label

The **Errors (7d)** column on the Super Admin organisations table is currently counting failed billing events from the last 30 days, while the label says 7 days. This plan aligns the data with the label.

What will change:
- Update the `public.admin_firm_overview` database view to filter `billing_events` for `occurred_at > now() - '7 days'::interval` instead of `30 days`.
- The view definition and grants remain the same; only the time window changes.

Verification:
- After the migration, the Super Admin organisations table will show the count of failed billing/payment events from the last 7 days for each organisation.
- No UI changes are required because the label is already correct.
