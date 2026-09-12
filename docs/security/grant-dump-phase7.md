# Phase 7 batch 1 — table grant dump, before and after

Generated from the live catalogue on 12 September 2026, either side of the grant-trim
migration. Only `anon` and `authenticated` are listed: `service_role` was not touched by the
migration, and every system context depends on it.

Rule applied: the target set is the **intersection** of what `authenticated` already held and
what a permissive policy for `authenticated` actually admits. Purely reductive — nothing was
granted that was not already held, so no row can turn from deny into allow. TRUNCATE,
REFERENCES, TRIGGER and MAINTAIN now go to nobody.

`anon` held **no privilege on any `public` table** before or after (revoked again defensively).

## Summary

| | before | after |
|---|---|---|
| tables where `authenticated` holds TRUNCATE | 47 | 0 |
| tables where `authenticated` holds REFERENCES / TRIGGER / MAINTAIN | 49 | 0 |
| tables where `authenticated` holds any privilege | 53 | 46 |
| tables where `authenticated` holds a write privilege with no matching policy | 9 | 0 |
| `anon` privileges | none | none |

## Before → after, per table (`authenticated`)

`D`=DELETE `I`=INSERT `S`=SELECT `U`=UPDATE; `+MA/RE/TR/TRUNC` = MAINTAIN / REFERENCES / TRIGGER / TRUNCATE.
"default" below means the untouched Supabase default `D,I,S,U + MA,RE,TR,TRUNC`.

| table | before | after | why |
|---|---|---|---|
| access_invites | default | D,I,S,U | permissive `ALL` policy (`is_firm_owner`) |
| audit_finding_snoozes | default | D,I,S,U | permissive `ALL` + `SELECT` policies |
| audit_findings | default | S | `SELECT` policy only |
| audit_log | S +MA,RE,TR | S | `SELECT` policy only; append-only by design |
| audit_runs | default | S | `SELECT` policy only |
| billing_events | default | S | `SELECT` policies only |
| client_access | default | D,I,S,U | per-command policies |
| client_cost_classifications | default | D,I,S,U | per-command policies |
| client_notes | default | D,I,S,U | per-command policies |
| client_reports | default | S | `SELECT` policy only; rows written server-side |
| client_statutory_accounts | default | D,I,S,U | permissive `ALL` + `SELECT` |
| client_subscriptions | S +MA,RE,TR | S | writes deliberately removed in Phase 3b |
| client_true_breakeven_inputs | default | D,I,S,U | per-command policies |
| client_xero_orgs | default | D,I,S,U | per-command policies |
| clients | default | D,I,S,U | per-command policies |
| consolidation_group_members | default | D,I,S,U | permissive `ALL` + `SELECT` |
| consolidation_groups | default | D,I,S,U | permissive `ALL` + `SELECT` |
| dashboard_card_order | default | D,I,S,U | own-row `ALL` policy |
| dashboard_configs | default | D,I,S,U | own-row `ALL` policy |
| email_send_log | default | **none** | only permissive policies are `auth.role() = 'service_role'` |
| email_send_state | default | **none** | service-role-only policy |
| email_unsubscribe_tokens | default | **none** | service-role-only policies |
| firm_members | default | D,I,S,U | owner-manages + read policies |
| firm_support_access | default | I,S,U | no DELETE policy (grants are never deleted, only revoked) |
| firms | S +MA | S | writes deliberately removed in Phase 2 (ownership fix) |
| loan_consolidation_accounts | default | D,I,S,U | per-command policies |
| loan_consolidation_snapshots | default | D,I,S,U | permissive `ALL` + `SELECT` |
| login_events | default | S | `SELECT` policy only |
| plan_levels | default | D,I,S,U | `plan_levels_read` + `plan_levels_write` |
| profiles | S,D +MA,RE,TR,TRUNC | S + UPDATE(display_name) | own-row read, display name only write |
| rate_limit_buckets | default | **none** | service-role-only policy |
| reconciliation_snapshots | default | S | `SELECT` policy only |
| report_cache | default | D,I,S,U | own-row `ALL` policy (legacy table — see backlog 35) |
| report_recipients | default | S | `SELECT` policy only |
| scenario_exclusions | default | D,I,S,U | client-access `ALL` policy |
| security_contact_details | default | **none** | the only app-role policy is `deny all to app roles` (`using false`) |
| security_settings | default | S | `SELECT` policy only |
| security_test_runs | S | S | unchanged |
| signup_requests | default | S,U | super-admin read + update policies |
| subscriptions | default | S | `SELECT` policies only |
| suppressed_emails | default | **none** | service-role-only policies |
| tier_settings | default | D,I,S,U | read + super-admin manage policies |
| tier_widget_config | default | D,I,S,U | per-command policies |
| unreconciled_lines | default | D,I,S,U + UPDATE(client_comment) | per-command policies; viewer column trigger unchanged |
| unreconciled_uploads | default | D,I,S,U | per-command policies |
| user_presence | I,S,U | I,S,U | unchanged |
| user_roles | default | D,I,S,U | own-read, super-admin manage |
| xero_api_errors | default | S | telemetry, read-only |
| xero_assessment_contact | default | D,I,S,U | super-admin read + write policies |
| xero_connections | MA + SELECT on 13 columns | **no table privilege** + SELECT on the same 13 columns | tokens have no grant at all |
| xero_oauth_states | default | D,I,S,U | per-command policies |
| xero_snapshot_runs | default | S | read-only; written by the system |
| xero_snapshots | default | S | read-only; written by the system |

## Column grants (unchanged in substance, re-granted after the revokes)

- `xero_connections`: SELECT on `id, user_id, firm_id, tenant_id, tenant_name, tenant_type, scopes, status, disconnected_at, base_currency, expires_at, created_at, updated_at`. `access_token_enc` and `refresh_token_enc` have no grant to any app role.
- `access_invites`: SELECT on `id, firm_id, email, role, invited_by, expires_at, accepted_at, created_at` (not `token_hash`).
- `profiles`: UPDATE on `display_name`.
- `unreconciled_lines`: UPDATE on `client_comment`.

## Proof

- `bun run security:check`: `FINGERPRINT: MATCH — 50b6584f9cef299593a997bddfa9b5e37674d9ee4a17afa75db6ca10b7bf4027`, 1,287 matrix rows, 1,222 proved here (1,222 passed, 0 failed), 0 known failures, 40 tests passed — identical totals to the Phase 6 baseline, so **no matrix row changed result**.
- `bunx tsgo --noEmit`: clean.
- Supabase linter: 74 warnings, all the pre-existing "signed-in users can execute SECURITY DEFINER function" class. No new finding class.
