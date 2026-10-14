import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const MFA_EXCLUSIONS: Record<string, string> = {
  plan_levels: "legacy non-data catalogue",
  tier_settings: "legacy non-data catalogue",
  session_activity: "read by app_private.is_aal2(); a guard here would recurse",
};

const ANON_GRANT_ALLOWLIST: Record<string, readonly string[]> = {};
const DATA_PRIVILEGES = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);

export function checkTableSecurity(sql: string): string[] {
  const errors: string[] = [];
  const tables = [...sql.matchAll(/^create table public\.([^ (]+)\s*\(/gim)].map((m) => m[1]);
  const policies = [...sql.matchAll(/^create policy (?:(?:"[^"]+")|(?:\S+)) on public\.([^ ]+) as (permissive|restrictive) for (select|insert|update|delete|all) to ([^ ]+)/gim)].map(
    (m) => ({ table: m[1], kind: m[2].toLowerCase(), command: m[3].toUpperCase(), roles: m[4].split(",") }),
  );
  const mfaTables = new Set(
    [...sql.matchAll(/^create policy mfa_aal2_required on public\.([^ ]+) as restrictive for all to authenticated using \(app_private\.is_aal2\(\)\) with check \(app_private\.is_aal2\(\)\);$/gim)].map((m) => m[1]),
  );

  for (const table of tables) {
    if (!MFA_EXCLUSIONS[table] && !mfaTables.has(table)) {
      errors.push(`${table}: missing the restrictive mfa_aal2_required policy`);
    }
  }
  for (const excluded of Object.keys(MFA_EXCLUSIONS)) {
    if (!tables.includes(excluded)) errors.push(`${excluded}: stale MFA exclusion; table does not exist`);
  }

  const grants = [...sql.matchAll(/^grant ([A-Z]+)(?: \([^)]*\))? on table public\.([^ ]+) to (anon|authenticated);$/gim)].map(
    (m) => ({ privilege: m[1].toUpperCase(), table: m[2], role: m[3].toLowerCase() }),
  );
  for (const grant of grants) {
    if (!DATA_PRIVILEGES.has(grant.privilege)) {
      errors.push(`${grant.table}: ${grant.role} has unnecessary ${grant.privilege}`);
      continue;
    }
    if (grant.role === "anon") {
      const allowed = ANON_GRANT_ALLOWLIST[grant.table] ?? [];
      if (!allowed.includes(grant.privilege)) {
        errors.push(`${grant.table}: anon has unnecessary ${grant.privilege}`);
      }
      continue;
    }
    const admitted = policies.some(
      (policy) =>
        policy.table === grant.table &&
        policy.kind === "permissive" &&
        policy.roles.includes("authenticated") &&
        (policy.command === grant.privilege || policy.command === "ALL"),
    );
    if (!admitted) {
      errors.push(`${grant.table}: authenticated has ${grant.privilege} but no matching permissive policy`);
    }
  }
  return errors;
}

/**
 * Tables read with the caller's own client (`.from("t").select("a, b")`) must
 * have a SELECT grant for authenticated — table-wide or on every listed column —
 * whenever an authenticated SELECT policy exists. A policy without a grant is a
 * silent "permission denied" (14 Oct card_catalogue outage). Admin-client reads
 * are skipped: service_role bypasses these grants by design.
 */
export function checkBrowserReadGrants(sql: string, sources: { path: string; text: string }[]): string[] {
  const errors: string[] = [];
  const selectPolicy = new Set(
    [...sql.matchAll(/^create policy (?:"[^"]+"|\S+) on public\.([^ ]+) as permissive for (?:select|all) to [^ ]*authenticated/gim)].map((m) => m[1]),
  );
  const tableGrant = new Set(
    [...sql.matchAll(/^grant SELECT on table public\.([^ ]+) to authenticated;$/gim)].map((m) => m[1]),
  );
  const colGrant = new Map<string, Set<string>>();
  for (const m of sql.matchAll(/^grant SELECT \(([^)]+)\) on table public\.([^ ]+) to authenticated;$/gim)) {
    if (!colGrant.has(m[2])) colGrant.set(m[2], new Set());
    for (const c of m[1].split(",")) colGrant.get(m[2])!.add(c.trim().replace(/"/g, ""));
  }
  for (const file of sources) {
    for (const m of file.text.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) {
      const table = m[1];
      if (!selectPolicy.has(table) || tableGrant.has(table)) continue;
      const before = file.text.slice(Math.max(0, m.index! - 120), m.index!);
      if (/admin/i.test(before.split(/[;\n]\s*(?:const|let|return|await)\b/).pop() ?? "")) continue;
      const after = file.text.slice(m.index!, m.index! + 400);
      const sel = after.match(/\.select\(\s*["'`]([^"'`]*)["'`]/);
      const cols = sel ? sel[1].split(",").map((c) => c.trim()).filter(Boolean) : [];
      const granted = colGrant.get(table);
      if (!granted) {
        errors.push(`${table}: read by ${file.path} but authenticated has no SELECT grant`);
        continue;
      }
      for (const c of cols) {
        if (c === "*" || c.includes("(") || c.includes(":")) continue;
        if (!granted.has(c)) errors.push(`${table}.${c}: read by ${file.path} but authenticated has no SELECT grant on it`);
      }
    }
  }
  return [...new Set(errors)];
}

function sourceFiles(dir: string, out: { path: string; text: string }[] = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) sourceFiles(f, out);
    else if (/\.tsx?$/.test(f) && !/integrations\/supabase\/types\.ts$/.test(f)) out.push({ path: f, text: readFileSync(f, "utf8") });
  }
  return out;
}

if (import.meta.main) {
  const fixture = resolve(process.cwd(), "tests/fixtures/rls-schema.sql");
  const sql = readFileSync(fixture, "utf8");
  const errors = [...checkTableSecurity(sql), ...checkBrowserReadGrants(sql, sourceFiles(resolve(process.cwd(), "src")))];
  if (errors.length > 0) {
    console.error("TABLE SECURITY: FAIL");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`TABLE SECURITY: OK — MFA and least-privilege grants verified`);
}