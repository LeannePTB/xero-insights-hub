# Stage 2 — Snapshot tables (schema only, inert)

Stage 2 creates the two tables that a shared Xero snapshot cache will later use, plus their grants, RLS and indexes. Nothing writes to them, nothing reads from them, no widget changes, no cron. The point of shipping them inert is that the access model can be reviewed and tested before any data exists.

Requires your approval before anything is created: both tables, their indexes, their grants and their policies.

## 1. Exact DDL

```sql
-- ---------------------------------------------------------------------------
-- xero_snapshot_runs: one row per refresh attempt for one Xero tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE public.xero_snapshot_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  firm_id            uuid NOT NULL REFERENCES public.firms(id)   ON DELETE CASCADE,
  tenant_id          text NOT NULL,
  trigger            text NOT NULL,               -- 'scheduled' | 'manual' | 'backfill'
  status             text NOT NULL DEFAULT 'running', -- 'running' | 'complete' | 'partial' | 'failed'
  reports_requested  integer NOT NULL DEFAULT 0,
  reports_succeeded  integer NOT NULL DEFAULT 0,
  reports_failed     integer NOT NULL DEFAULT 0,
  error              text,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  duration_ms        integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_snapshot_runs_trigger_chk CHECK (trigger IN ('scheduled','manual','backfill')),
  CONSTRAINT xero_snapshot_runs_status_chk  CHECK (status  IN ('running','complete','partial','failed'))
);

CREATE INDEX xero_snapshot_runs_tenant_started_idx
  ON public.xero_snapshot_runs (tenant_id, started_at DESC);
CREATE INDEX xero_snapshot_runs_client_started_idx
  ON public.xero_snapshot_runs (client_id, started_at DESC);
CREATE INDEX xero_snapshot_runs_firm_idx
  ON public.xero_snapshot_runs (firm_id);

-- ---------------------------------------------------------------------------
-- xero_snapshots: one row per (client, tenant, report_key, params_hash).
-- Latest value only; history lives in the runs table, not here.
-- ---------------------------------------------------------------------------
CREATE TABLE public.xero_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  firm_id          uuid NOT NULL REFERENCES public.firms(id)   ON DELETE CASCADE,
  tenant_id        text NOT NULL,
  report_key       text NOT NULL,                 -- 'balance_sheet', 'profit_and_loss', ...
  params_hash      text NOT NULL,                 -- sha256 hex of the canonical param string
  params           jsonb NOT NULL DEFAULT '{}'::jsonb, -- the canonical params, readable
  source_endpoint  text NOT NULL,                 -- e.g. 'Reports/BalanceSheet'
  payload          jsonb NOT NULL,
  payload_version  integer NOT NULL,
  as_at            timestamptz NOT NULL,          -- the "as at" the figures describe
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  complete         boolean NOT NULL DEFAULT true,
  run_id           uuid REFERENCES public.xero_snapshot_runs(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_snapshots_unique_key
    UNIQUE (client_id, tenant_id, report_key, params_hash)
);

CREATE INDEX xero_snapshots_tenant_report_idx
  ON public.xero_snapshots (tenant_id, report_key, fetched_at DESC);
CREATE INDEX xero_snapshots_client_report_idx
  ON public.xero_snapshots (client_id, report_key, fetched_at DESC);
CREATE INDEX xero_snapshots_firm_idx
  ON public.xero_snapshots (firm_id);

CREATE TRIGGER xero_snapshots_set_updated_at
  BEFORE UPDATE ON public.xero_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER xero_snapshot_runs_set_updated_at
  BEFORE UPDATE ON public.xero_snapshot_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

Both tables carry `client_id`, `firm_id` and `tenant_id`. `tenant_id` alone is not an access key — `client_id` is what entitlement is actually expressed against, and `firm_id` is denormalised so a policy never has to widen to "any client on this tenant".

Note on `tg_set_updated_at`: it already exists; the two `CREATE TRIGGER` statements above are new objects and are part of what needs approval.

## 2. Exact RLS policies

```sql
GRANT SELECT ON public.xero_snapshots     TO authenticated;
GRANT SELECT ON public.xero_snapshot_runs TO authenticated;
GRANT ALL    ON public.xero_snapshots     TO service_role;
GRANT ALL    ON public.xero_snapshot_runs TO service_role;
-- no anon grant: every policy scopes to auth.uid().

ALTER TABLE public.xero_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_snapshots     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.xero_snapshot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_snapshot_runs FORCE  ROW LEVEL SECURITY;

CREATE POLICY "entitled users read client snapshots"
  ON public.xero_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_access_client(auth.uid(), client_id)
    AND app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "entitled users read snapshot runs"
  ON public.xero_snapshot_runs
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_access_client(auth.uid(), client_id)
    AND app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );
```

No INSERT, UPDATE or DELETE policy exists for `authenticated`, so those are denied by default: writes are service_role only, from the refresh path in Stage 3.

- Role for both policies: `authenticated` only.
- Helpers: `public.user_can_access_client` (organisation membership, direct `client_access`, or an active support grant) and `app_private.user_can_access_tenant` (tenant → organisations → `has_firm_access` / `platform_staff_can_access_firm`).
- `FORCE ROW LEVEL SECURITY` is deliberate here and matches the direction of section 12 item 2 in the spec — the table owner is not exempt.

Both checks are required, not either. `user_can_access_client` answers "may this person see this client", `user_can_access_tenant` answers "is this Xero organisation one they are entitled to". A row that satisfies only one of them is a row whose ownership has drifted and is not served.

## 3. The leak argument, attempt by attempt

**A member of organisation B calls a server function passing organisation A's `tenant_id`.** It never gets as far as the table. Per spec section 10, `tenant_id` is resolved server-side from the client the caller is authorised for; a caller-supplied tenant is a filter, never a grant. If a future server function did pass it through, the query runs as the user through `context.supabase`, so the policy still evaluates `user_can_access_tenant(auth.uid(), 'A')` — false for a member of B — and zero rows come back. The only client that bypasses RLS is `supabaseAdmin`, and Stage 2 ships no code that touches these tables at all.

**A member of B queries `xero_snapshots` directly through PostgREST filtered on A's `client_id`.** PostgREST connects as `authenticated`. The grant permits SELECT; the policy then evaluates per row. `user_can_access_client(uid, A_client)` is false, so the row is filtered out before the caller's `client_id=eq.` filter is even meaningful. A filter narrows a result set; it cannot widen one.

**A user whose client access was revoked yesterday reads a snapshot written while they had access.** The policy is evaluated at read time against current membership, not against who wrote the row. `firm_members.status` moves to `removed`, or the `client_access` row goes, and the next read returns nothing. There is no denormalised "readers" list on the row, and the JWT carries no cached grant (spec section 0 item 6), so revocation is immediate.

**A client is moved between organisations, or a connection is re-pointed to a different tenant.** This is the case the dual check exists for. Rows carry a `firm_id` snapshot of the old ownership, but the policy does not consult it — it re-derives access from the live `clients` row and the live `xero_connections`/`client_xero_orgs` mapping every read. After a move, a member of the old organisation fails `user_can_access_client`; a member of the new organisation passes it but, until the connection follows, may fail `user_can_access_tenant` and simply sees nothing. Stale rows are unreadable rather than mis-readable. Stage 3 will additionally delete snapshot rows on move and on disconnect, but the correctness does not depend on that housekeeping running. `ON DELETE CASCADE` on `client_id` removes rows when a client is deleted.

**Consolidation: a group member the caller cannot access.** Consolidation groups are lists of `client_id`s. Every snapshot row is per client, so a consolidated read is a multi-row read and each row is filtered independently. A caller entitled to two of three group members receives two rows. That means a consolidated total must be assembled from what RLS returned and must be flagged as partial when the row count is short of the group size — never silently summed. Stage 3 owns that; Stage 2 records it as a requirement so the consolidation reader is not written assuming it always gets the full set.

## 4. Cache poisoning and staleness

A wrong row here is served to everyone entitled to that tenant, so `params_hash` is the same class of risk as the Stage 1 memo key.

- `params_hash` is built by exactly one exported function, sharing the canonicalisation already proven in `xeroMemoKey`: keys sorted, empty and undefined values dropped, key and value percent-encoded so a value containing `=` or `&` cannot forge a different parameter set, joined with `&`, then sha256 hex. Reporting basis, as-at date and period range are parameters like any other, so two reports that differ only in basis have different hashes.
- The hash never spans tenants: `tenant_id` and `client_id` are columns in the unique constraint, not inputs to the hash. A hash collision across tenants cannot select the wrong row because the lookup is always keyed by all four columns.
- `params` is stored alongside the hash in readable form so a suspect row can be explained rather than guessed at.
- `payload_version` is stored per row. A payload shape change bumps the constant; rows below the current version are treated as absent and refetched. That is how a payload schema change happens with no migration.
- Racing refreshes: writes are `INSERT ... ON CONFLICT (client_id, tenant_id, report_key, params_hash) DO UPDATE ... WHERE excluded.fetched_at > xero_snapshots.fetched_at`. Last-fetched wins, the older result cannot overwrite the newer one, and the unique constraint means the race produces one row rather than two. Only complete results are written; a failed report writes nothing and leaves the previous row in place, with the failure recorded on the run.

## 5. Interaction with the Stage 1 memo

They compose in one direction only, and only one of them ever calls Xero.

The read order in Stage 3 is: snapshot lookup → if usable, return it → otherwise live fetch through `xeroGet`, which is where the request memo lives. The memo sits strictly beneath the network call and is keyed per inbound request; the snapshot is keyed per tenant and shared. They cannot disagree within one request because within one request a given report is resolved once: either it came from a snapshot, or it came from a live fetch that the memo then replays to later callers in the same request. Nothing writes a snapshot into the memo or a memo entry into a snapshot. Snapshot reads are not themselves memoised in Stage 2 or 3 — a Postgres read is cheap and the duplication problem was Xero calls, not queries.

## 6. What Stage 2 does not do

- No application code changes at all: no server function reads or writes these tables, no widget behaviour changes, no query keys change.
- No cron job, no `pg_cron` schedule, no public refresh route.
- No backfill, no seed rows. Both tables ship empty.
- No change to the monthly management report, which stays live per your instruction, and no change to Transaction Search.
- The Supabase types file will regenerate and gain two table types. Nothing imports them.

## 7. Rollback

```sql
DROP TABLE IF EXISTS public.xero_snapshots     CASCADE;
DROP TABLE IF EXISTS public.xero_snapshot_runs CASCADE;
```

Dropping the tables removes their indexes, constraints, policies, grants and the two `set_updated_at` triggers with them. `tg_set_updated_at` itself is shared and stays. Because no application code references either table, the drop returns the app to exactly today's behaviour; the only follow-up is regenerating the types file. There are no inbound foreign keys from other tables, so `CASCADE` has nothing beyond these two tables to remove.

## 8. Tests to write (named, not written yet)

`src/lib/xero/snapshot-key.test.ts` — `params_hash` construction:
1. same params in different argument order produce the same hash
2. empty string and undefined values are dropped identically to the request builder
3. reporting basis difference produces a different hash
4. as-at date difference produces a different hash
5. a value containing `=` or `&` cannot forge another parameter set (the forged-separator case, mirroring the memo test)
6. the hash is stable across runs — a fixed input has a pinned expected digest

`src/lib/xero/snapshot-rls.test.ts` — RLS, run against seeded fixtures with real user sessions:
1. a member of organisation A reads A's snapshot rows
2. a member of organisation B reads zero rows for A's client, both unfiltered and with an explicit `client_id` filter
3. a revoked member reads zero rows for a snapshot written while they had access
4. a `client_access`-only viewer reads their client's rows and no sibling client's rows
5. an active support grantee reads; the same super admin with no active grant reads zero
6. `authenticated` cannot insert, update or delete a snapshot row
7. a consolidation caller entitled to a subset of group members receives only the subset

## Approval needed

Everything in sections 1 and 2: two tables, six indexes, two triggers, four grants, four `ALTER TABLE` RLS statements and two policies. Say the word and I will submit exactly that SQL as a single migration.
