/**
 * Exhaustive cross-organisation isolation sweep.
 *
 * Complements tests/rls-isolation.test.ts (hand-picked tables) by walking EVERY
 * public table in the live-catalogue fixture. For each table that carries an
 * organisation/client/Xero/person attribute, it seeds one row attributed
 * wholly to Organisation B, then proves that people outside Organisation B —
 * an Org A owner, Org A staff, someone with no membership, and a System
 * Administrator with no membership — read zero of those rows.
 *
 * A new table is covered automatically. A table that cannot be seeded fails the
 * suite unless it is listed in NOT_SEEDABLE with a reason, so coverage can only
 * shrink on purpose. Synthetic rows only; PGlite in-process; never production.
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
const GROUP_B = "bbbbbbbb-9999-4222-8222-222222222222";
const UPLOAD_B = "bbbbbbbb-8888-4222-8222-222222222222";
const THREAD_B = "bbbbbbbb-7777-4222-8222-222222222222";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const OWNER_A = "99999999-1111-4111-8111-111111111111";
const STAFF_A = "99999999-1112-4111-8111-111111111112";
const NOBODY = "99999999-0000-4000-8000-000000000000";
const SUPER = "99999999-5555-4555-8555-555555555555"; // System Administrator, no membership
const OWNER_B = "99999999-2222-4222-8222-222222222222";

/** Column name → the Organisation B value that attributes a row to Org B. */
const B_VALUES: Record<string, string> = {
  firm_id: ORG_B,
  client_id: CLIENT_B,
  tenant_id: TENANT_B,
  xero_connection_id: CONN_B,
  user_id: OWNER_B,
  owner_user_id: OWNER_B,
  group_id: GROUP_B,
  upload_id: UPLOAD_B,
  thread_id: THREAD_B,
};

/** Tables with no organisation/client/person attribute: nothing to leak across organisations. */
const NOT_SEEDABLE: Record<string, string> = {};

let db: PGlite;
let attributed: { table: string; cols: string[] }[] = [];
const seedErrors: string[] = [];

function sid(uid: string) {
  return `55555555-${uid.slice(9, 13)}-4555-8555-${uid.slice(24)}`;
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2", session_id: sid(uid) }),
  ]);
  await db.exec("set local role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

function bPredicate(cols: string[]) {
  return cols.map((c) => `${c}::text = '${B_VALUES[c]}'`).join(" or ");
}

async function visibleB(table: string, cols: string[]): Promise<number> {
  await db.exec("savepoint s");
  try {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from public.${table} where ${bPredicate(cols)}`,
    );
    await db.exec("release savepoint s");
    return r.rows[0]!.n;
  } catch (e) {
    await db.exec("rollback to savepoint s");
    // permission denied = no grant at all: zero rows reachable.
    if (/permission denied/i.test(String(e))) return 0;
    throw e;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/rls-schema.sql"), "utf8"));

  const users = [OWNER_A, STAFF_A, NOBODY, SUPER, OWNER_B];
  await db.exec(`
    insert into auth.users(id, email) values ${users.map((u) => `('${u}', '${u.slice(0, 8)}-${u.slice(9, 13)}@example.invalid')`).join(",")};
    insert into auth.sessions(id, user_id, created_at) values ${users.map((u) => `('${sid(u)}', '${u}', now())`).join(",")};
    insert into public.firms(id, name, owner_user_id) values ('${ORG_A}', 'Org A', '${OWNER_A}'), ('${ORG_B}', 'Org B', '${OWNER_B}');
    insert into public.firm_members(id, firm_id, user_id, role, status) values
      (gen_random_uuid(), '${ORG_A}', '${OWNER_A}', 'owner', 'active'),
      (gen_random_uuid(), '${ORG_A}', '${STAFF_A}', 'staff', 'active'),
      (gen_random_uuid(), '${ORG_B}', '${OWNER_B}', 'owner', 'active');
    insert into public.user_roles(id, user_id, role) values (gen_random_uuid(), '${SUPER}', 'super_admin');
    insert into public.clients(id, name, owner_user_id, firm_id) values
      ('${CLIENT_A}', 'Client A', '${OWNER_A}', '${ORG_A}'), ('${CLIENT_B}', 'Client B', '${OWNER_B}', '${ORG_B}');
    insert into public.xero_connections(id, user_id, tenant_id, tenant_name, firm_id, status, expires_at) values
      ('${CONN_A}', '${OWNER_A}', '${TENANT_A}', 'File A', '${ORG_A}', 'active', now() + interval '1 day'),
      ('${CONN_B}', '${OWNER_B}', '${TENANT_B}', 'File B', '${ORG_B}', 'active', now() + interval '1 day');
    insert into public.client_xero_orgs(id, client_id, xero_connection_id) values
      (gen_random_uuid(), '${CLIENT_A}', '${CONN_A}'), (gen_random_uuid(), '${CLIENT_B}', '${CONN_B}');
    insert into public.consolidation_groups(id, firm_id, name) values ('${GROUP_B}', '${ORG_B}', 'Group B');
    insert into public.unreconciled_uploads(id, client_id, filename, line_count) values ('${UPLOAD_B}', '${CLIENT_B}', 'b.csv', 1);
    insert into public.trixie_threads(id, user_id, firm_id, client_id, workspace, title, created_at, updated_at)
      values ('${THREAD_B}', '${OWNER_B}', '${ORG_B}', '${CLIENT_B}', 'client', 'b', now(), now());
  `);

  const cols = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and column_name = any($1)`,
    [Object.keys(B_VALUES)],
  );
  const byTable = new Map<string, string[]>();
  for (const r of cols.rows) byTable.set(r.table_name, [...(byTable.get(r.table_name) ?? []), r.column_name]);

  // Seeding is a system context: skip app triggers (e.g. the pending-onboard
  // owner guard) so every table gets its synthetic Org B row. Reads below run
  // with triggers and RLS exactly as in production.
  await db.exec("set session_replication_role = replica");
  // Rows already seeded above, so they are not seeded twice.
  const preSeeded = new Set(["firms", "firm_members", "clients", "xero_connections", "client_xero_orgs", "consolidation_groups", "unreconciled_uploads", "trixie_threads"]);
  for (const [table, c] of [...byTable.entries()].sort()) {
    if (table in NOT_SEEDABLE) continue;
    attributed.push({ table, cols: c });
    if (preSeeded.has(table)) continue;
    // Some tables carry a uuid id with no default in the fixture; set it if present.
    const idCol = await db.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_schema='public' and table_name=$1 and column_name='id'`,
      [table],
    );
    const names = [...c];
    const values = c.map((k) => `'${B_VALUES[k]}'`);
    if (idCol.rows[0]?.data_type === "uuid") {
      names.push("id");
      values.push("gen_random_uuid()");
    }
    try {
      await db.exec(`insert into public.${table}(${names.join(",")}) values (${values.join(",")})`);
    } catch (e) {
      seedErrors.push(`${table}: ${String(e).slice(0, 160)}`);
    }
  }
  await db.exec("set session_replication_role = origin");
}, 120_000);

describe("every attributed table: Organisation B rows are invisible outside Organisation B", () => {
  it("every attributed table was seeded (coverage cannot shrink silently)", () => {
    expect(seedErrors).toEqual([]);
    expect(attributed.length).toBeGreaterThan(50);
  });

  const outsiders: [string, string][] = [
    ["Org A owner", OWNER_A],
    ["Org A staff", STAFF_A],
    ["no membership", NOBODY],
    ["System Administrator with no membership", SUPER],
  ];
  for (const [label, uid] of outsiders) {
    it(`${label} reads zero Organisation B rows in every table`, async () => {
      const leaks: string[] = [];
      await asUser(uid, async () => {
        for (const { table, cols } of attributed) {
          const n = await visibleB(table, cols);
          if (n > 0) leaks.push(`${table} (${n})`);
        }
      });
      expect(leaks).toEqual([]);
    });
  }

  it("positive control: Organisation B's owner can read its own client and organisation", async () => {
    await asUser(OWNER_B, async () => {
      expect(await visibleB("clients", ["firm_id"])).toBe(1);
      expect(await visibleB("firms", ["owner_user_id"])).toBe(1);
    });
  });
});
