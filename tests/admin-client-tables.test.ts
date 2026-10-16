/**
 * Rule 7: a server function that reaches a client-data table with supabaseAdmin
 * must have that exact (file, table) pair in docs/security/admin-client-register.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const CLIENT_TABLE =
  /^(clients|client_[a-z_]+|statement_[a-z_]+|unreconciled_[a-z_]+|xero_snapshots|loan_consolidation_[a-z_]+|consolidation_[a-z_]+|report_[a-z_]+)$/;

function walk(d: string, o: string[] = []): string[] {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) walk(f, o);
    else if (/\.tsx?$/.test(f)) o.push(f);
  }
  return o;
}

export function adminClientTables(text: string): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/\bsupabaseAdmin\b/.test(code)) return [];
  const s = new Set<string>();
  for (const m of code.matchAll(/(?:supabaseAdmin|\badmin\b)[\s\S]{0,40}?\.from\(\s*["']([a-z_]+)["']/g))
    if (CLIENT_TABLE.test(m[1]!)) s.add(m[1]!);
  return [...s].sort();
}

const found = new Set<string>();
for (const f of walk(join(ROOT, "src"))) {
  const p = relative(ROOT, f);
  if (p.startsWith("src/integrations/")) continue;
  for (const t of adminClientTables(readFileSync(f, "utf8"))) found.add(`${p}::${t}`);
}

const reg = readFileSync(join(ROOT, "docs/security/admin-client-register.md"), "utf8");
const block = reg.split("<!-- client-tables:start -->")[1]?.split("<!-- client-tables:end -->")[0] ?? "";
const listed = new Set<string>();
for (const line of block.split("\n")) {
  const m = line.match(/^- `([^`]+)`:\s*(.+)$/);
  if (m) for (const t of m[2]!.split(",")) listed.add(`${m[1]}::${t.trim()}`);
}

describe("supabaseAdmin on client tables is registered per table", () => {
  it("detects an admin read of a client table", () => {
    expect(adminClientTables('const { supabaseAdmin } = x; (supabaseAdmin as any)\n  .from("client_cost_classifications")')).toEqual(["client_cost_classifications"]);
    expect(adminClientTables('context.supabase.from("client_cost_classifications")')).toEqual([]);
  });
  it("has a register entry for every (file, client table) pair", () => {
    const missing = [...found].filter((k) => !listed.has(k));
    expect(missing, `Unregistered supabaseAdmin client-table use:\n${missing.join("\n")}`).toEqual([]);
  });
  it("has no stale register pairs", () => {
    const stale = [...listed].filter((k) => !found.has(k));
    expect(stale, `Stale client-table register pairs:\n${stale.join("\n")}`).toEqual([]);
  });
  it("keeps health.functions.ts off the service-role client", () => {
    expect(readFileSync(join(ROOT, "src/lib/health.functions.ts"), "utf8")).not.toMatch(/\bsupabaseAdmin\b/);
  });
});
