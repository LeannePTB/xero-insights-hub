# Fix: adding a client to another organisation fails

## What's happening

Adding a client to "DRTABT Projects" fails with `new row violates row-level security policy for table "clients"`.

Confirmed cause: the database only lets an **owner of that organisation** create clients. A platform admin who isn't a member of DRTABT Projects passes the app's permission check (super admins are explicitly allowed), but the insert itself still runs as that admin, so the database rejects it. Listing and removing clients were already updated to work for platform admins; creating was not.

## The fix

In the create-client step:

- Determine once whether the caller is a platform super admin (already done for the permission check) and reuse that result.
- When the caller is a super admin, perform the client insert — and the linked Xero organisation rows — through the privileged server client, exactly like the existing delete path.
- Everyone else keeps going through the normal, permission-checked path, so no access is widened for regular users.
- Set the new client's owner to the caller as today; organisation membership continues to drive who can see it.

## Technical detail

`createClient` in `src/lib/clients.functions.ts` inserts via `context.supabase`, which is subject to the `firm owners manage firm clients` policy (`is_firm_owner(auth.uid(), firm_id)`). Change it to select the writer (`context.supabase` vs. `supabaseAdmin`) based on the already-computed super-admin flag, applying it to both the `clients` insert and the `client_xero_orgs` insert. No database migration or policy change is needed.
