# Final hygiene batch — backlog 40, 41, 42, 43 (12 Sep 2026)

Classification: SECURITY-RELEVANT (grants, definer/trigger functions, RLS policies, a public route's credential).
Goal: **no legitimate user's access changes**. Every matrix result must be identical before and after each step.

## Live numbers re-verified this turn (reconciled with the owner's counts)

- 3 `app_private` trigger functions with `proacl = NULL` (= EXECUTE to PUBLIC): `enforce_client_limit()`, `enforce_xero_org_limit()`, `enforce_xero_org_limit_on_move()`. **Matches.**
- **34** policies in `public` with `polroles = '{0}'` (no explicit `TO`). **Matches.**
- **20** permissive `FOR ALL` policies in `public`; every one has a non-null `WITH CHECK`, so the split is mechanical. **Matches.**
- `public.email_unsubscribe_tokens`: **1 row total, 1 unused** (so exactly one live outstanding link).

## 1. Backlog 41 — revoke EXECUTE (safest first)

One migration: `REVOKE EXECUTE ... FROM PUBLIC, anon` on the three trigger functions. A trigger function is invoked by the table owner's trigger, not by the caller's EXECUTE privilege, so `PLAN_LIMIT_CLIENTS` / `PLAN_LIMIT_XERO_ORGS` must still fire. Proof: re-read `proacl` after, and confirm the triggers are still attached and their bodies unchanged.

## 2. Backlog 40 — unsubscribe token at rest

- Add `token_hash text` to `email_unsubscribe_tokens`, backfill the one existing row with `sha256(token)` (so the outstanding link keeps working), make it `NOT NULL UNIQUE`, then **drop `token`** — both columns are never left populated.
- `src/lib/email/send.server.ts` and `src/routes/lovable/email/transactional/send.ts`: mint a fresh plaintext token per send, store only the hash, put the plaintext in the emailed link only. Reuse-by-lookup is impossible with a hash, so the row is updated with the new hash instead (still one row per email address).
- `src/routes/email/unsubscribe.ts`: look up by `token_hash = sha256(token)`, and rate limit GET and POST by IP with `enforceRateLimit`.

## 3. Backlog 42 — explicit `TO` on every policy

`ALTER POLICY ... TO <role>` (no drop/recreate, so there is no window with no policy). The four system tables' "Service role can …" policies go `TO service_role`; everything else goes `TO authenticated`. `anon` holds no privilege on any table, and `service_role` bypasses RLS, so no result can change. Matrix re-run after each table; any changed row is reverted for that table and reported.

## 4. Backlog 43 — split permissive `FOR ALL`

Each becomes SELECT/UPDATE/DELETE with the same `USING` and INSERT/UPDATE with the same `WITH CHECK`. The RESTRICTIVE `mfa_aal2_required` guards stay `FOR ALL`. Matrix after each table; stop and report on any change.

## Then

Regenerate the RLS fixture and the definer register, close backlog 40–43 with evidence, update `roadmap.md`, and finish with the owner screen test list and the Security report.
