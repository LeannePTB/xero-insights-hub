# Organisation settings page with self-serve subscription

Add a dedicated **Settings** button on the organisation page that opens a new settings screen where the organisation owner can view, change or cancel their subscription.

## What you'll see

- A **Settings** button next to the organisation title on `/firms/{id}`.
- A new page: **Organisation settings** with a Plan & subscription section:
  - Current plan, status, renewal/trial date, clients used vs allowed.
  - **Change plan** — choose any enabled plan level; shows what each includes (clients, Xero files, consolidation, dashboard tiers) and blocks a downgrade if the organisation already has more clients than the smaller plan allows.
  - **Cancel subscription** — confirm dialog; sets the plan to cancel at the end of the current period, with a clear "access until {date}" note. A **Resume subscription** button appears while a cancellation is pending.
  - Free-forever organisations see their status and no cancel option.
- The Plan & subscription block stays on the organisation dashboard as a read-only summary with a link into settings.
- Default cards and Support access stay where they are for now.

## Who can do what

- Organisation **owners** can change and cancel their own plan (self-serve, takes effect immediately in the app).
- **Staff** members see the settings page read-only.
- **Super admins** keep their existing controls and can also act on any organisation.
- Every change and cancellation is written to the audit log.

## Technical notes

- New route `src/routes/_authenticated/firms.$firmId.settings.tsx` (child of the existing `firms.$firmId` layout), with its own `head()` metadata.
- New server functions in `src/lib/firm-subscription.functions.ts`, all using `requireSupabaseAuth`:
  - `getFirmSubscription({ firmId })` — plan row, available plan levels from `plan_levels` (enabled, scope firm), current client count.
  - `changeFirmPlan({ firmId, planKey })` — verifies caller is firm owner or super admin, validates client count against the target `client_limit`, updates `public.subscriptions.tier` (plus limits) and writes an `audit_log` entry.
  - `setFirmCancellation({ firmId, cancel })` — sets `cancel_at_period_end`, and `status = 'canceled'` when the period has already lapsed; logs to `audit_log`.
- `public.subscriptions` currently denies INSERT/UPDATE/DELETE through RLS, so these writes go through `supabaseAdmin` loaded inside the handler **after** the owner/super-admin check via `context.supabase`.
- No payment provider is wired up; this changes the plan record in the app only. Stripe fields on the row are left untouched so a future billing integration can take over.
- Reuse `firmPlanView`/`toneClasses` from `src/lib/firmPlans` and the existing plan-summary query keys so the dashboard refreshes after a change.
