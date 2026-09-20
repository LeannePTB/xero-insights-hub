import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

if (import.meta.main) {
  const fixture = resolve(process.cwd(), "tests/fixtures/rls-schema.sql");
  const errors = checkTableSecurity(readFileSync(fixture, "utf8"));
  if (errors.length > 0) {
    console.error("TABLE SECURITY: FAIL");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`TABLE SECURITY: OK — MFA and least-privilege grants verified`);
}