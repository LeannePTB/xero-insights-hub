# Attestations for checks no system can read

SECURITY-RELEVANT: new table, new SECURITY DEFINER function, posture check, admin screen.
Threat: an attestation must never be forgeable, never self-stamped by the caller, and never
able to make a machine-readable control look green. Invariants touched: PK 1 (deny by default),
PK 2 (aal2 in the database), PK 3 (super_admin here is platform metadata only, Path C), PK 6
(the rule lives in the database), PK 9 (nothing loosens).

## 1. `public.security_attestations`
`check_key` (PK/unique), `confirmed_by uuid`, `confirmed_at`, `note` (≤500 chars),
`expires_after_days int default 180`, timestamps. RLS on; `revoke all from anon, authenticated`;
`grant select` to `authenticated` only; `grant all` to `service_role`; per-command SELECT policy
naming `authenticated` and requiring `app_private.me_is_super_admin()`; restrictive
`mfa_aal2_required` guard; no insert/update/delete policy at all (writes only via the definer
function). Audited by `audit_table_change`.

## 2. `public.record_security_attestation(_check_key text, _note text)`
aal2 + super admin asserted first, `SET search_path = ''`, `EXECUTE` revoked from `PUBLIC`/`anon`.
Refuses any key not in a fixed attestable list (`leaked_password` only). Stamps `auth.uid()` and
`now()` itself — no caller-supplied identity or time. Upserts one row per key and writes
`audit_log` action `security_attestation_recorded`.

## 3. Posture
`hibp`/`leaked_password` check in `src/lib/security-posture.functions.ts` reads the attestation
through `context.supabase` (RLS applies): OK when current, Warn "confirmed on <date>, needs
re-confirming" when older than `expires_after_days`, Warn "not verified" when absent. Evidence
always states this is a recorded human confirmation, naming who and when. Attestation is applied
only to checks in an explicit `ATTESTABLE` map; never to a machine-readable check.

## 4. Screen
`SecurityPostureCard` shows a Confirm control with an optional note on attestable checks, super
admin only, with wording that the person is asserting they checked the backend setting
themselves. No attestation is recorded on the owner's behalf.

## 5. Docs and matrix
Spec §17; `xero-assessment-inputs.md` MFA/password row becomes "attested in-product, with who
and when, setting not machine-readable"; matrix rows for super-admin-only recording and reading,
denial for staff/support/viewers/aal1/anonymous, and that no path sets `confirmed_by`/
`confirmed_at`. Regenerate fixture, definer register, access matrix.

## After
`bun run security:check` before/after with fingerprint, typecheck, linter.
