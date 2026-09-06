/**
 * Cross-organisation isolation suite.
 *
 * Runs entirely in-process against PGlite (Postgres compiled to WASM) using
 * tests/fixtures/rls-schema.sql — a generated structural mirror of the live
 * access-control layer (enums, table columns, the app_private/public
 * authorisation helpers, RLS enablement, every SELECT-capable policy).
 *
 * It NEVER touches the production database and seeds only synthetic rows.
 * Regenerate the fixture with scripts/dump-rls-fixture.sql after any change to
 * a policy or an authorisation helper.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const CLIENT_A = "aaaaaaaa-1111-4111-8111-111111111111";
const CLIENT_B = "bbbbbbbb-2222-4222-8222-222222222222";
const CONN_A = "aaaaaaaa-cccc-4111-8111-111111111111";
const CONN_B = "bbbbbbbb-cccc-4222-8222-222222222222";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const USER_1 = "99999999-1111-4111-8111-111111111111"; // member of Org A only
const USER_NONE = "99999999-0000-4000-8000-000000000000"; // no membership, owns nothing
const USER_B = "99999999-2222-4222-8222-222222222222"; // Org B's own person

/** Tables asserted for cross-organisation leakage, with how a row is attributed. */
const ORG_B_ROW_PREDICATE: Record<string, string> = {
  xero_connections: `firm_id = '${ORG_B}'`,
  clients: `firm_id = '${ORG_B}'`,
  client_xero_orgs: `client_id = '${CLIENT_B}'`,
  client_notes: `client_id = '${CLIENT_B}'`,
  xero_snapshots: `firm_id = '${ORG_B}'`,
  client_reports: `firm_id = '${ORG_B}'`,
  reconciliation_snapshots: `client_id = '${CLIENT_B}'`,
  consolidation_groups: `firm_id = '${ORG_B}'`,
  loan_consolidation_snapshots: `group_id = '${ORG_B}'`,
  unreconciled_lines: `client_id = '${CLIENT_B}'`,
  report_cache: `tenant_id = '${TENANT_B}'`,
  xero_oauth_states: `firm_id = '${ORG_B}'`,
};

let db: PGlite;

async function asUser<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await db.exec("set local role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

async function countVisible(table: string, where: string): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${where}`);
  return res.rows[0]!.n;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/rls-schema.sql"), "utf8"));

  // Synthetic data only. Two organisations, one client each, one Xero file each.
  await db.exec(`
    insert into auth.users(id, email) values
      ('${USER_1}', 'user1@example.invalid'), ('${USER_NONE}', 'nobody@example.invalid'), ('${USER_B}', 'userb@example.invalid');
    insert into public.firms(id, name, owner_user_id) values
      ('${ORG_A}', 'Org A', '${USER_1}'), ('${ORG_B}', 'Org B', '${USER_B}');
    insert into public.firm_members(id, firm_id, user_id, role, status) values
      (gen_random_uuid(), '${ORG_A}', '${USER_1}', 'owner', 'active');
    insert into public.clients(id, name, owner_user_id, firm_id) values
      ('${CLIENT_A}', 'Client A', '${USER_1}', '${ORG_A}'),
      ('${CLIENT_B}', 'Client B', '${USER_B}', '${ORG_B}');
    insert into public.xero_connections(id, user_id, tenant_id, tenant_name, firm_id, status, expires_at, access_token_enc, refresh_token_enc, enc_version) values
      ('${CONN_A}', '${USER_1}', '${TENANT_A}', 'File A', '${ORG_A}', 'active', now() + interval '1 day', 'ctA', 'rtA', 1),
      ('${CONN_B}', '${USER_B}', '${TENANT_B}', 'File B', '${ORG_B}', 'active', now() + interval '1 day', 'ctB', 'rtB', 1);
    insert into public.client_xero_orgs(id, client_id, xero_connection_id) values
      (gen_random_uuid(), '${CLIENT_A}', '${CONN_A}'), (gen_random_uuid(), '${CLIENT_B}', '${CONN_B}');
    insert into public.client_notes(id, client_id, body) values
      (gen_random_uuid(), '${CLIENT_A}', 'note a'), (gen_random_uuid(), '${CLIENT_B}', 'note b');
    insert into public.xero_snapshots(id, client_id, firm_id, tenant_id, report_key, params_hash, params, source_endpoint, payload, payload_version, as_at, fetched_at, complete) values
      (gen_random_uuid(), '${CLIENT_A}', '${ORG_A}', '${TENANT_A}', 'pnl', 'h', '{}', 'e', '{}', 1, now(), now(), true),
      (gen_random_uuid(), '${CLIENT_B}', '${ORG_B}', '${TENANT_B}', 'pnl', 'h', '{}', 'e', '{}', 1, now(), now(), true);
    insert into public.client_reports(id, client_id, firm_id, report_key, period_end, payload, payload_version, status, version, complete, generated_at) values
      (gen_random_uuid(), '${CLIENT_A}', '${ORG_A}', 'monthly', current_date, '{}', 1, 'final', 1, true, now()),
      (gen_random_uuid(), '${CLIENT_B}', '${ORG_B}', 'monthly', current_date, '{}', 1, 'final', 1, true, now());
    insert into public.reconciliation_snapshots(id, client_id, tenant_id, report_key, as_at, payload, complete, generated_at) values
      (gen_random_uuid(), '${CLIENT_A}', '${TENANT_A}', 'recon', current_date, '{}', true, now()),
      (gen_random_uuid(), '${CLIENT_B}', '${TENANT_B}', 'recon', current_date, '{}', true, now());
    insert into public.report_cache(id, user_id, tenant_id, report_key, params_hash, payload, fetched_at) values
      (gen_random_uuid(), '${USER_1}', '${TENANT_A}', 'pnl', 'h', '{}', now()),
      (gen_random_uuid(), '${USER_B}', '${TENANT_B}', 'pnl', 'h', '{}', now());
    insert into public.consolidation_groups(id, firm_id, name) values
      ('${ORG_A}', '${ORG_A}', 'Group A'), ('${ORG_B}', '${ORG_B}', 'Group B');
    insert into public.loan_consolidation_snapshots(id, group_id, as_at, payload, generated_at) values
      (gen_random_uuid(), '${ORG_A}', current_date, '{}', now()),
      (gen_random_uuid(), '${ORG_B}', current_date, '{}', now());
    insert into public.unreconciled_uploads(id, client_id, filename, line_count) values
      ('${CLIENT_A}', '${CLIENT_A}', 'a.csv', 1), ('${CLIENT_B}', '${CLIENT_B}', 'b.csv', 1);
    insert into public.unreconciled_lines(id, upload_id, client_id, account_name, row_index, client_comment) values
      (gen_random_uuid(), '${CLIENT_A}', '${CLIENT_A}', 'acc', 1, ''),
      (gen_random_uuid(), '${CLIENT_B}', '${CLIENT_B}', 'acc', 1, '');
    insert into public.subscriptions(id, firm_id, tier, status, cancel_at_period_end, consolidation_enabled, wip_enabled) values
      (gen_random_uuid(), '${ORG_A}', 'ptb', 'active', false, false, false),
      (gen_random_uuid(), '${ORG_B}', 'ptb', 'active', false, false, false);
    insert into public.client_subscriptions(id, client_id, subscription_type, status, dashboard_tier) values
      (gen_random_uuid(), '${CLIENT_A}', 'free_forever', 'free_forever', 'basic'),
      (gen_random_uuid(), '${CLIENT_B}', 'free_forever', 'free_forever', 'basic');
    insert into public.xero_oauth_states(state, user_id, firm_id, expires_at, flow) values
      ('sa', '${USER_1}', '${ORG_A}', now() + interval '1 hour', 'connect'),
      ('sb', '${USER_B}', '${ORG_B}', now() + interval '1 hour', 'connect');
  `);
});

describe("cross-organisation isolation", () => {
  for (const [table, orgBRows] of Object.entries(ORG_B_ROW_PREDICATE)) {
    it(`${table}: a member of Org A sees no Org B rows`, async () => {
      const visible = await asUser(USER_1, () => countVisible(table, orgBRows));
      expect(visible).toBe(0);
    });
  }

  it("a member of Org A can still see their own organisation's Xero connection", async () => {
    const visible = await asUser(USER_1, () => countVisible("xero_connections", `firm_id = '${ORG_A}'`));
    expect(visible).toBe(1);
  });

  it("a user with no membership anywhere sees nothing", async () => {
    await asUser(USER_NONE, async () => {
      for (const table of Object.keys(ORG_B_ROW_PREDICATE)) {
        expect(await countVisible(table, "true"), table).toBe(0);
      }
    });
  });

  it("no policy under test is USING (true)", async () => {
    const res = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policy where pg_get_expr(polqual, polrelid) = 'true'`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });
});
