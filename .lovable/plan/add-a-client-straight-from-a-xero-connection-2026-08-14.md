# Add a client straight from a Xero connection

Today you create a client subscription by typing a name, then connect its Xero file from client settings. This adds a one-step path: authorise the Xero file first, and the client is created automatically using the Xero organisation's name.

## What you'll see

- On the organisation page (and the "New client" screen) a primary button: **Add client from Xero**.
- Clicking it sends you straight to Xero's consent screen, where you tick the organisation(s) you want.
- On return, for every newly authorised organisation that isn't already linked somewhere:
  - a client subscription is created, named exactly as the Xero organisation
  - the Xero file is linked to it and stamped to your organisation
  - default dashboard widgets apply as they do for any new client
- One organisation authorised → you land directly on that new client's dashboard. Several → you land back on the organisation page with a toast listing what was created.
- The existing "type a name" path stays available for clients you want to set up before their Xero file exists.

## Guard rails (unchanged rules, enforced in this flow too)

- The organisation's client limit and subscription status are checked before starting, and again on return; if the limit is hit part-way, the remaining files are skipped with a clear message.
- Files already assigned to another client (in any organisation) are never taken over — they're reported as skipped.
- Only members of the organisation (or a platform admin acting for it) can run the flow.
- One client : one Xero file on creation. Extra files still get added from client settings under a Multi company tier.

## Technical notes

- `xero_oauth_states`: add a nullable `firm_id` column and allow `flow = 'onboard'`, so the callback knows which organisation to create clients in when there is no `client_id` yet.
- `src/lib/xero/connections.functions.ts`: new `startXeroOnboardConnect` server fn — validates firm membership, subscription status, and remaining client allowance, records the state row with `flow: 'onboard'` and `firm_id`, then returns the authorize URL (PKCE unchanged).
- `src/routes/api/public/xero/callback.ts`: after the existing token exchange and `xero_connections` upsert, add an `onboard` branch that, per returned tenant, skips already-assigned connections, re-checks the firm client limit, and inserts `clients` + `client_xero_orgs` + `firm_id` stamp via `supabaseAdmin`, writing `audit_log` entries (`client_created_from_xero`, `xero_file_linked`). Redirects to the new client dashboard or back to `/firms/$firmId` with a summary query param.
- Client creation reuses the existing quota helpers (`clientLimitFor`, `firmLimitCatalogue`, `getUnassignedConnectionsForFirm`) so behaviour matches `createClient`.
- UI: buttons in `src/routes/_authenticated/firms.$firmId.tsx` and `src/routes/_authenticated/clients.new.tsx`, plus toast handling for the return query params.
