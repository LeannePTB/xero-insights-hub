## Goal

Give Chantelle access to all clients owned by the "Positive Traction Clients" firm, matching admin and allyce.

## Change

Insert one row into `firm_members`:

- firm: Positive Traction Clients
- user: chantelle@positivetraction.com.au (`2bf4db34-f133-4cd4-b6ef-2be8c19aeacd`)
- role: `owner` (same as admin/allyce, so she can manage firm settings and invites)

## Result

Chantelle will immediately see Positive Traction (and any future client added to that firm) in her dashboard. No code changes required.

If you'd prefer she join as a non-owner (read-only / member) instead of `owner`, say so before approving and I'll switch the role.