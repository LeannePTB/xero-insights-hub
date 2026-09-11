/**
 * Phase 2 guardrails — static guard tests.
 *
 * These read the source tree and fail the build when a new change quietly
 * reopens a hole. Known failures are reported, never silently passed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { AAL1_ALLOWLIST } from "../docs/security/server-fn-aal1-allowlist";

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const REGISTER = join(ROOT, "docs/security/admin-client-register.md");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, "utf8") }));

/** Reports a list of offenders as a readable failure message. */
function report(title: string, offenders: string[]) {
  return `${title}\n${offenders.map((o) => `  - ${o}`).join("\n")}`;
}

describe("1. every server function requires aal2", () => {
  it("has no createServerFn without requireAal2 outside the allow-list", () => {
    const allowed = new Set(AAL1_ALLOWLIST.map((a) => `${a.file}::${a.fn}`));
    const offenders: string[] = [];

    for (const { path, text } of FILES) {
      // Split on declarations so each segment covers one builder chain.
      const parts = text.split(/export const /).slice(1);
      for (const part of parts) {
        if (!part.includes("createServerFn(")) continue;
        const name = part.slice(0, part.indexOf(" ")).trim();
        const chain = part.slice(0, part.indexOf(".handler(") + 1);
        if (chain.includes("requireAal2")) continue;
        if (allowed.has(`${path}::${name}`)) continue;
        offenders.push(`${path}::${name} — add requireAal2, or ask the owner to add an allow-list entry`);
      }
    }

    expect(offenders, report("Server functions missing requireAal2:", offenders)).toEqual([]);
  });

  it("has no allow-list entry pointing at a function that no longer exists", () => {
    const stale = AAL1_ALLOWLIST.filter((a) => {
      const f = FILES.find((x) => x.path === a.file);
      return !f || !f.text.includes(`export const ${a.fn}`);
    }).map((a) => `${a.file}::${a.fn}`);
    expect(stale, report("Stale aal1 allow-list entries:", stale)).toEqual([]);
  });

  it("builds every middleware list literally, so the scan cannot be evaded", () => {
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      for (const m of text.matchAll(/\.middleware\(([^)]*)\)/g)) {
        const arg = m[1]!.trim();
        if (!/^\[\s*(requireAal2|requireSupabaseAuth)\s*\]$/.test(arg))
          offenders.push(`${path} — .middleware(${arg})`);
      }
    }
    expect(offenders, report("Non-literal middleware lists:", offenders)).toEqual([]);
  });
});

describe("2. every supabaseAdmin use is registered and verified", () => {
  const registerText = existsSync(REGISTER) ? readFileSync(REGISTER, "utf8") : "";

  /** Register rows: | file | function | verdict | reason | */
  const registered = new Map<string, { fn: string; verdict: string }[]>();
  for (const line of registerText.split("\n")) {
    const m = line.match(/^\|\s*`?(src\/[^`|\s]+)`?\s*\|\s*`?([^`|]+?)`?\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const [, file, fn, verdict] = m;
    registered.set(file!, [...(registered.get(file!) ?? []), { fn: fn!.trim(), verdict: verdict!.trim() }]);
  }

  const usingAdmin = FILES.filter(({ text }) => /\bsupabaseAdmin\b/.test(text));

  it("has a register", () => {
    expect(registerText.length, "docs/security/admin-client-register.md is missing").toBeGreaterThan(0);
  });

  it("registers every file that uses supabaseAdmin", () => {
    const missing = usingAdmin.filter((f) => !registered.has(f.path)).map((f) => f.path);
    expect(
      missing,
      report(
        "Unregistered supabaseAdmin use — verify the call path and add it to docs/security/admin-client-register.md:",
        missing,
      ),
    ).toEqual([]);
  });

  it("has no register row for a file that no longer uses supabaseAdmin", () => {
    const stale = [...registered.keys()].filter((p) => !usingAdmin.some((f) => f.path === p));
    expect(stale, report("Stale register rows:", stale)).toEqual([]);
  });

  it("reports rule 7 violations as known failures, never as passes", () => {
    const violations = [...registered.entries()].flatMap(([file, rows]) =>
      rows.filter((r) => /KNOWN FAILURE/i.test(r.verdict)).map((r) => `${file}::${r.fn} — ${r.verdict}`),
    );
    // Known failures are expected to exist until the fixing phase lands. They
    // are printed every run so they can never be forgotten.
    if (violations.length) console.warn(report("KNOWN FAILURES (rule 7, supabaseAdmin):", violations));
    expect(
      violations.every((v) => /backlog \d+/i.test(v)),
      "every KNOWN FAILURE row must name its backlog item",
    ).toBe(true);
  });
});

describe("3. identity and recipient decisions never use profiles.email", () => {
  it("lists every profiles.email read as a known failure with a backlog item", () => {
    const hits: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith("src/integrations/supabase/")) continue;
      text.split("\n").forEach((line, i) => {
        if (/profile[s]?[^\n]*\.email\b/.test(line) || /\bp\.email\b/.test(line))
          hits.push(`${path}:${i + 1} — ${line.trim()}`);
      });
    }
    // Backlog: "verified email must come from auth.users, not profiles.email".
    if (hits.length) console.warn(report("KNOWN FAILURE (backlog 21) profiles.email reads:", hits));
    expect(hits.length, report("profiles.email reads (expected 5 known display fallbacks):", hits)).toBeLessThanOrEqual(
      5,
    );
  });
});

describe("4. tenant_id is never taken from the request", () => {
  it("has no server function reading tenantId from body, query string or header", () => {
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (!/\.functions\.tsx?$/.test(path) && !path.startsWith("src/routes/api/")) continue;
      text.split("\n").forEach((line, i) => {
        if (/(getRequestHeader|searchParams\.get|req(uest)?\.headers\.get)\([^)]*tenant/i.test(line))
          offenders.push(`${path}:${i + 1} — ${line.trim()}`);
      });
    }
    expect(offenders, report("tenantId read from the request:", offenders)).toEqual([]);
  });
});

describe("5. the readable access matrix matches its source of truth", () => {
  it("docs/security/access-matrix.md is up to date", async () => {
    const { MATRIX } = await import("../docs/security/access-matrix");
    const md = readFileSync(join(ROOT, "docs/security/access-matrix.md"), "utf8");
    expect(md).toContain(`Rows: **${MATRIX.length}**`);
  });
});
