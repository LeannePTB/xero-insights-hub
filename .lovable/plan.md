# Fix: connecting Xero links every org to the client

## What's happening

When you press "Connect a Xero org" from a client, Xero hands back **every organisation your Xero login has ever authorised** — not just the one you picked on the consent screen. The callback currently links all of them to the client that started the flow.

Confirmed in the data: the client **DRTABT Projects** is linked to three Xero orgs (Positive Traction, Hay Officesmart Newsagency, DRTABT Projects Pty Ltd), while Positive Traction and Home Hunter Watch each have one. Anyone given viewer access to DRTABT Projects can currently see the other two organisations' data.

Nothing is wrong with the access rules themselves — the wrong *links* were created at connect time.

## The fix

**1. Only link what's new.** Before sending you to Xero, record which organisations are already known. On return, link only organisations that were not there before. Re-authorising an existing org no longer drags other orgs onto the client.

**2. Ask when it's ambiguous.** If the return contains more than one new organisation (or none), don't guess — return to the client's settings page and show a short "Which organisation belongs to this client?" chooser listing only the organisations from that authorisation. You tick one (or several, for multi-company clients) and confirm.

**3. Isolate every subscription.** A Xero organisation can belong to only one client subscription. All dashboard reads, organisation lists, selectors, and linking actions must start from that subscription's `client_xero_orgs` records—never from every Xero connection owned by the advisor. A multi-company subscription may have several files, but those files remain exclusive to that one subscription.

**4. Clean up DRTABT Projects.** Remove Positive Traction and Hay Officesmart Newsagency from DRTABT Projects. Its only linked Xero file will be **DRTABT Projects Pty Ltd**. This cleanup happens before the unique database rule is applied.

## Multi-file subscriptions

Today "multi company" is a yes/no switch — once a client has that tier they can link an unlimited number of Xero files. That becomes a real number instead:

- Every client carries an **allowed Xero files** count. Default is **1**.
- Clients without the Multi company tier stay at 1 and can't be raised.
- Clients on Multi company get a count you set (2, 3, 5, …) when you set up or edit the subscription. It's editable on the client's settings page by advisors and super admins.
- The client's settings page shows "Xero files: 2 of 3 used". Once the allowance is full, both "Connect a Xero org" and "Link existing" are disabled with a clear message explaining they need a bigger multi-company allowance.
- Two separate limits stay in force, and the tighter one wins:
  - the **firm/subscription limit** on total connected Xero files (already enforced in `startXeroConnect`), and
  - the **per-client allowance** on how many of those files can hang off one client.
- The chooser from step 2 respects the allowance: if you tick more organisations than the client has room for, it refuses and tells you how many slots remain.
- The chooser never offers an organisation already assigned to another subscription, and client viewers never receive those organisations' names or data in any response.
- Reducing an allowance below what's already linked is blocked — unlink first.

## Technical detail

- Migration:
  - `ALTER TABLE public.clients ADD COLUMN max_xero_orgs integer NOT NULL DEFAULT 1;`
  - `ALTER TABLE public.client_xero_orgs ADD CONSTRAINT client_xero_orgs_conn_unique UNIQUE (xero_connection_id);`
  - `ALTER TABLE public.xero_oauth_states ADD COLUMN known_tenant_ids text[];`
  - Data cleanup of the DRTABT duplicate links runs before the unique constraint is added.
- New shared helper `resolveClientOrgAllowance(clientId)` (server-side): returns `{ allowance, used, isMulti }` — allowance forced to 1 when the client has no `multi_company` tier row in `client_access`. Replaces the boolean `clientIsMultiCompany` check in `src/lib/clients.functions.ts` and the `isMulti` branch in `src/routes/api/public/xero/callback.ts`.
- `src/routes/api/public/xero/callback.ts`: compare tenant IDs from `/connections` against the pre-authorisation snapshot on the `xero_oauth_states` row. Auto-link only when exactly one new tenant results **and** the client has a free slot; otherwise redirect to `/clients/{id}/settings?xero_pick=<state>` with the candidate tenants, or `?xero_error=org_allowance_full`.
- `src/lib/xero/connections.functions.ts`: `startXeroConnect` writes the snapshot and pre-checks the per-client allowance alongside the existing firm connection cap; new `listPendingXeroLink` + `linkXeroOrgsToClient` server fns back the chooser (both `requireSupabaseAuth`, both re-checking client management rights and the allowance).
- `src/lib/clients.functions.ts`: `createClient` and the link/attach paths enforce `max_xero_orgs`; new `setClientOrgAllowance` server fn (advisor/super-admin only) validates `>= current linked count` and `= 1` when not multi-company.
- `src/routes/_authenticated/clients.$clientId.settings.tsx`: render the pending-link chooser, show the "x of y files used" meter with an allowance editor, and filter "Link existing" to unlinked connections only.
- `src/lib/tiers.ts`: update the `multi_company` description to mention the configurable file allowance.

