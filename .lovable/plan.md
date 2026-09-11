# Follow-up: profile names, presence grants, audit check

**Classification:** SECURITY-RELEVANT. This changes profile writes, table grants, a security-definer posture check, and audit logging.

## Scope and threats

- Keep every profile self-edit restricted to the caller’s own row under aal2 and existing RLS.
- Remove authenticated INSERT entirely and restrict authenticated UPDATE to `display_name`; first confirm no legitimate session path inserts profiles.
- Make super-admin edits a Path C platform-metadata operation, authorised in the database and written atomically with `profile_name_changed` audit evidence.
- Prevent anonymous or excessive table privileges on presence data.
- Prevent the posture card from reporting a false audit-log failure while retaining Action for any real authenticated write capability.
- Do not bulk-edit existing names or alter invite/signup screens.

## Implementation

1. **Database rules**
   - Add one guarded `SECURITY DEFINER` function for super-admin profile-name changes. It will assert aal2, require `me_is_super_admin()`, validate the target and name, update the profile, and append the old/new values to `audit_log` in one transaction.
   - Revoke function execution from `PUBLIC` and `anon`; grant only `authenticated`.
   - Revoke authenticated INSERT and table-level UPDATE on `profiles`, then grant UPDATE on `display_name` only. Drop the now-unreachable INSERT policy while preserving own-row UPDATE RLS and aal2.
   - Change `handle_new_user()` so absent name metadata stores `NULL`, not the email.
   - Revoke all `user_presence` privileges from `anon`; grant authenticated exactly SELECT, INSERT, UPDATE and revoke DELETE, TRUNCATE, REFERENCES, TRIGGER.
   - Correct only `audit_append_only` inside `security_posture()`: count permissive authenticated/public write policies and test INSERT/UPDATE/DELETE/TRUNCATE with `has_table_privilege`.

2. **Name editing**
   - Add Zod validation for trimmed names: 1–80 characters and not email-shaped.
   - Add own-name read/update functions using the normal aal2 session and existing own-row RLS.
   - Add a name form to Account settings.
   - Add a super-admin name editor to the existing Advisors page, calling the database function and refreshing advisor/presence data.

3. **Presence display**
   - Return display name and the verified email from `auth.users` separately from the guarded online-users path; do not trust `profiles.email` for this display.
   - Treat blank or email-shaped display names as unset.
   - Chips and the full online list show muted “Name not set”; verified email always appears in the tooltip and admin lists so self-chosen names cannot conceal identity.

4. **Documentation**
   - Add the explicit default-grant revocation requirement to the new-table backlog rule.
   - Add open backlog items that public invite/signup does not collect a name and that self-chosen names can imitate another person, requiring verified auth email in identity surfaces.
   - Record this follow-up on the roadmap.

## Verification

- Do not write test values to real profiles. Verify the current admin account renders “Name not set”; the owner will enter real names after publishing and confirm the chip and `profile_name_changed` audit row.
- Prove invalid, email-shaped, cross-user, non-super-admin, and aal1 attempts are rejected without saving profile values. Verify grants/policies and transaction rollback or read-only calls rather than mutating real profile rows.
- Verify every `anon` privilege on `user_presence` is false, authenticated has exactly SELECT/INSERT/UPDATE, and the heartbeat still writes a server-owned timestamp.
- Run the live posture checks and list every result with reasons for Warn/Action; verify sidebar/admin counts come from the shared result.
- Run the database self-check if present, role-based access tests, typecheck, security scan, and linter; require no new finding class.
- Finish with the required Security report: files/migration, invariants, evidence, checks, and backlog changes.
