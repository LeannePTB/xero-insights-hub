## Remaining work (excluding Stripe + landing page)

Grouped by priority. Tell me which to start with after this is approved.

---

## P0 — Onboarding & access (blocks new signups working end-to-end)

1. **Post-signup onboarding wizard** — after a new organisation owner sets their password they currently land on an empty dashboard. Add a 3-step wizard:
   1. Confirm organisation details
   2. Connect first Xero file (button → existing Xero OAuth flow)
   3. Create first client (or skip)
   Render at `/onboarding`, redirect there from `_authenticated/route.tsx` when `firm.onboarded_at IS NULL`.

2. **Organisation staff invites** — owners can invite extra staff to their organisation. New route `_authenticated/settings.team.tsx`: list `firm_members`, invite by email (reuses email queue), revoke. Role within firm: `owner` / `member` (already on `firm_members`).

3. **Client viewer invites** — let an org invite the client's CFO/owner to view *their own* dashboard. New flow on `clients.$clientId.settings.tsx`: invite by email → creates `client_access` row + sends magic-link email. Viewer sees only that client's dashboard (RLS already supports it; UI gating to confirm).

4. **Password reset** — confirm the public `/auth` page has "Forgot password" wired to Supabase `resetPasswordForEmail` and that `/set-password` handles the recovery token, not just invite tokens.

---

## P1 — Core product gaps

5. **Multi-org dashboards (multi_company tier)** — `tiers.ts` lists `multi_company` but `clients.$clientId.index.tsx` only renders one tenant. Add a tenant switcher + rolled-up KPI view when a client has >1 `client_xero_orgs`.

6. **Xero connection management** — `xero/connections.functions.ts` exists, but there's no UI page to list connected Xero orgs, see token health, reconnect, or disconnect. Add `_authenticated/settings.xero.tsx` for super-admins and org owners.

7. **Client list/search** — once an org has more than a handful of clients the `firms.$firmId.tsx` grid will get unwieldy. Add a search box + simple filter (tier, has-xero).

8. **Empty/loading/error states** — sweep the dashboard widgets (`RevenueExpenseKpis`, `PnlWidget`, `BreakevenWidget`, `PayablesWidget`, `ReceivablesWidget`, `TaxLiabilityWidget`) for "Xero not connected" vs "no data yet" vs "Xero error" states. Today some show blank cards.

9. **Notes / activity per client** — `NotesCard` exists; verify create/edit/delete works for org members (not just super-admins). Add @-mentions later (out of scope now).

---

## P2 — Admin / ops (Positive Traction internal)

10. **Activity log viewer polish** — `settings.activity.tsx` exists. Add filters (actor, target type, date range) and CSV export.

11. **Super-admin organisation management** — `admin.firms.$firmId.tsx` exists but needs: change owner, suspend organisation, force-disconnect Xero, see subscription status (lands once Stripe is in).

12. **Audit log retention** — schedule monthly prune of `audit_log` and `login_events` older than 12 months (pg_cron).

13. **Email deliverability** — `email_send_log`, `suppressed_emails`, `email_send_state` are in place. Add an admin page to inspect queue depth, retry failed sends, and view suppression list.

---

## P3 — Polish

14. **Mobile responsiveness pass** — dashboard grid, client list, and settings pages. Current viewport ratio suggests you test on mobile.

15. **In-app notifications bell** — when a Xero sync fails, a subscription event happens, or a teammate is invited.

16. **Help / docs surface** — small "?" button on each widget linking to a short explainer (can be a single `/help` page initially).

17. **Branding per organisation** — let orgs upload a logo shown to their client viewers (white-label-lite).

18. **2FA** — Supabase MFA enrollment in `settings.account.tsx`. Optional for owners, encouraged for super-admins.

---

## Cross-cutting cleanup (do alongside the above, not as separate phases)

- Rename `firms` table & code references → `organisations` (you asked to standardise on "Organisation"; internal names still say firm and that will keep biting us). Touches DB column names, RLS policies, ~15 files. Worth one focused migration turn.
- Tighten remaining `is_advisor()` policy usages on `client_notes`, `unreconciled_*` if they still grant cross-org reads (we fixed clients/access — sweep the rest).
- Sentry/error reporting confirmation — `lovable-error-reporting.ts` is present; verify it's wired into the root error boundary.

---

## Suggested order

1. **P0 #1 onboarding** + **P0 #4 password reset** (one turn)
2. **P0 #2 staff invites** + **P0 #3 client viewer invites** (one turn)
3. Cross-cutting **firms → organisations rename** (one turn, isolated)
4. **P1 #5 multi-org** + **P1 #6 Xero connection UI** (one turn)
5. **P1 #8 widget empty states** (one turn)
6. P2 + P3 picked off in priority order

Confirm the order or reshuffle and I'll start on whichever block you pick first.