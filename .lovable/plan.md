# Fix: connecting Xero links every org to the client

## What's happening

When you press "Connect a Xero org" from a client, Xero hands back **every organisation your Xero login has ever authorised** — not just the one you picked on the consent screen. The callback currently links all of them to the client that started the flow.

Confirmed in the data: the client **DRTABT Projects** is linked to three Xero orgs (Positive Traction, Hay Officesmart Newsagency, DRTABT Projects Pty Ltd), while Positive Traction and Home Hunter Watch each have one. Anyone given viewer access to DRTABT Projects can currently see the other two organisations' data.

Nothing is wrong with the access rules themselves — the wrong *links* were created at connect time.

## The fix

**1. Only link what's new.** Before sending you to Xero, record which organisations are already known. On return, link only organisations that were not there before. Re-authorising an existing org no longer drags other orgs onto the client.

**2. Ask when it's ambiguous.** If the return contains more than one new organisation (or none), don't guess — return to the client's settings page and show a short "Which organisation belongs to this client?" chooser listing only the organisations from that authorisation. You tick one (or several, for multi-company clients) and confirm.

**3. One organisation, one client.** Add a database rule so a Xero organisation can be linked to at most one client, and drop the "Link existing" list back to organisations that aren't linked anywhere yet. This makes each client subscription genuinely independent.

**4. Clean up the existing bad links.** Remove the Positive Traction and Hay Officesmart links from DRTABT Projects, leaving each client with only its own organisation.

**5. Keep the existing multi-company rule.** Clients on the multi-company tier can still hold more than one org — they just have to be chosen deliberately.

## Technical detail

- `src/routes/api/public/xero/callback.ts`: compare the tenant IDs returned by `/connections` against a pre-authorisation snapshot stored on the `xero_oauth_states` row (new `known_tenant_ids text[]` column, written in `startXeroConnect`). Auto-link only when exactly one new tenant results; otherwise redirect to `/clients/{id}/settings?xero_pick=<state>` with the candidate tenants.
- `src/lib/xero/connections.functions.ts`: `startXeroConnect` writes the snapshot; new `listPendingXeroLink` + `linkXeroOrgsToClient` server fns back the chooser (both `requireSupabaseAuth`, both re-checking `user_can_manage_client`).
- `src/routes/_authenticated/clients.$clientId.settings.tsx`: render the chooser when `xero_pick` is present; filter "Link existing" to connections with no `client_xero_orgs` row.
- Migration: `ALTER TABLE public.client_xero_orgs ADD CONSTRAINT client_xero_orgs_conn_unique UNIQUE (xero_connection_id);` plus the `xero_oauth_states.known_tenant_ids` column.
- Data cleanup runs after the constraint is safe to add (the duplicate links must be deleted first).
