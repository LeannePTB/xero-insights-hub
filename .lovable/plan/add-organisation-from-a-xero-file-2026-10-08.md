# Add organisation from a Xero file

Classification: SECURITY-RELEVANT (organisation creation, Xero OAuth, plan limits, client ownership).

## What you'll get

**Stage 1 — our team (build now)**
1. The "Add organisation" dialog gets a second option: **"Start from a Xero file"**, next to the current manual form.
2. You pick the package (number of clients, Advisory, Consolidation, Branding) as you do now, then press **Connect to Xero**. The customer (or you, with their login) signs in to Xero and grants access.
3. Back in the app, a list shows every Xero file that login has access to. You tick the **first file**. The organisation and its first client are created and named from that file, and the file is linked to that client.
4. You can tick **extra files** from the same list, up to the package's client limit. Each one becomes another client in that organisation. Files above the limit can't be ticked, and the existing plan-limit check still blocks them.
5. Owner login works as it does today (invite, password or none). It is never taken from the Xero sign-in automatically.

**Stage 2 — customers do it themselves (not built yet)**
This would change the "request-only until payments" setup you asked for, and it adds a new way to create an organisation. Under the security rules you need to approve a change to those rules first. My suggestion: once payments are live, the Sign Up with Xero request flow becomes "sign up, pay, then choose your files", using the same file-picker. I'll plan that separately when you're ready.

## Technical details
- Reuse the existing PKCE `xero_oauth_states` flow with a new `flow='admin_onboard'` value. The state row stores the pending package and the caller. The validation trigger lets this flow through only when the caller is a practice-team member (aal2).
- The callback stores tokens the same way it does today and hands back a short-lived pending-onboard id. No tenant ids in the URL.
- New definer function `admin_onboard_organisation_from_xero(pending_id, first_tenant, extra_tenants[])`: aal2, caller guard (practice team), atomic. It creates the organisation, plan, clients and `client_xero_orgs` links in one go, using `firm_plan_limits` and the existing triggers. `tenant_id` values are checked against the tenants authorised on that pending connection and are only ever used as a filter. Audited.
- New server fns with `requireAal2`, Zod, and errors that reveal nothing specific. Any `supabaseAdmin` use stays inside the OAuth callback and is registered.
- Not changed: `is_always_free`, ownership (still `transfer_organisation_ownership`), viewer and support paths.
- After the change: matrix rows, RLS fixture regenerated, `security:check`, linter, backlog entry, and a security report.
