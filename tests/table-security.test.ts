import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBrowserReadGrants, checkTableSecurity } from "../scripts/check-table-security";

const fixture = readFileSync(join(process.cwd(), "tests/fixtures/rls-schema.sql"), "utf8");

function grantsFor(table: string, role: "anon" | "authenticated"): string[] {
  return [...fixture.matchAll(new RegExp(`^grant ([A-Z]+)(?: \\([^)]*\\))? on table public\\.${table} to ${role};$`, "gim"))]
    .map((match) => match[1].toUpperCase())
    .sort();
}

describe("public table security contract", () => {
  it("accepts the current live catalogue", () => {
    expect(checkTableSecurity(fixture)).toEqual([]);
  });

  it("fails when a public data table loses the restrictive aal2 guard", () => {
    const broken = fixture.replace(
      /^create policy mfa_aal2_required on public\.org_card_defaults[^\n]*\n?/m,
      "",
    );
    expect(checkTableSecurity(broken)).toContain(
      "org_card_defaults: missing the restrictive mfa_aal2_required policy",
    );
  });

  it("fails when a table receives an unnecessary default grant", () => {
    const broken = `${fixture}\ngrant DELETE on table public.security_test_runs to authenticated;\n`;
    expect(checkTableSecurity(broken)).toContain(
      "security_test_runs: authenticated has DELETE but no matching permissive policy",
    );
  });

  it("pins the intended grants for the three regression tables", () => {
    expect(grantsFor("org_card_defaults", "anon")).toEqual([]);
    expect(grantsFor("org_card_defaults", "authenticated")).toEqual(["SELECT"]);
    expect(grantsFor("user_presence", "anon")).toEqual([]);
    expect(grantsFor("user_presence", "authenticated")).toEqual(["INSERT", "SELECT", "UPDATE"]);
    expect(grantsFor("security_test_runs", "anon")).toEqual([]);
    expect(grantsFor("security_test_runs", "authenticated")).toEqual(["SELECT"]);
  });

  it("fails when app code reads a policy-covered table without a grant (card_catalogue regression)", () => {
    const broken = fixture.replace(/^grant SELECT on table public\.card_catalogue to authenticated;\n/m, "");
    const src = [{ path: "x.ts", text: `db.from("card_catalogue").select("card_key, report_sections")` }];
    expect(checkBrowserReadGrants(fixture, src)).toEqual([]);
    expect(checkBrowserReadGrants(broken, src)).toContain(
      "card_catalogue.report_sections: read by x.ts but authenticated has no SELECT grant on it",
    );
  });

  it("does not flag admin-client reads of deliberately ungranted tables", () => {
    const src = [{ path: "x.ts", text: `const { data } = await supabaseAdmin.from("security_contact_details").select("id")` }];
    expect(checkBrowserReadGrants(fixture, src)).toEqual([]);
  });
});
