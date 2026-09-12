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
import {
  CONVERTED_FILES,
  REGISTERED_DB_AUTH_CALLS,
  REGISTERED_DB_AUTH_WRAPPERS,
} from "../docs/security/converted-files";

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
    const m = line.match(/^\|\s*`(src\/[^`]+)`\s*\|(.*)$/);
    if (!m) continue;
    const file = m[1]!;
    const cols = m[2]!.split("|").map((c) => c.trim());
    registered.set(file, [
      ...(registered.get(file) ?? []),
      { fn: cols[0] ?? "", verdict: cols[1] ?? "" },
    ]);
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
  /**
   * KNOWN FAILURE — backlog 22. These sites read profiles.email purely as a
   * display fallback when display_name is null. The verified email must come
   * from auth.users instead. Recorded, reported every run, never a pass.
   * A profiles.email read in any OTHER file fails the build.
   *
   * Phase 4 batch 4 closed the three report sites
   * (monthly-report-context.server.ts, monthly-report.server.ts,
   * report-verdict.server.ts): a report byline is now the display name only,
   * so no sign-in email can reach a client-facing report.
   */
  const KNOWN_PROFILES_EMAIL_READS: string[] = [];
  // Phase 4 batch 5 closed backlog 22: no source file reads profiles.email.

  it("has no profiles.email read outside the recorded known failures", () => {
    const hits: string[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith("src/integrations/supabase/")) continue;
      text.split("\n").forEach((line, i) => {
        if (/profile[s]?[^\n]*\.email\b/.test(line) || /\bp\.email\b/.test(line))
          hits.push(`${path}:${i + 1} — ${line.trim()}`);
      });
    }
    // Backlog 22 is closed: any hit is now a hard failure.
    const unexpected = hits.filter((h) => !KNOWN_PROFILES_EMAIL_READS.some((f) => h.startsWith(f)));
    expect(unexpected, report("New profiles.email reads — use the verified auth.users email:", unexpected)).toEqual(
      [],
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

describe("6. converted files decide nothing themselves (Phase 4, per batch)", () => {
  /**
   * A READ of an access table is an access decision. A write through the
   * caller's own session (a support request, an owner approving one) is the
   * caller exercising a policy, not a decision made here — row-level security
   * still decides whether it is allowed.
   */
  const ACCESS_TABLE_READS = (text: string): number[] => {
    const lines: number[] = [];
    const re = /from\(\s*["'](?:user_roles|firm_members|client_access|firm_support_access)["']\s*\)/g;
    for (const m of text.matchAll(re)) {
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 60);
      const next = after.match(/\.\s*([a-zA-Z]+)\s*\(/);
      if (next?.[1] !== "select") continue;
      lines.push(text.slice(0, m.index!).split("\n").length);
    }
    return lines;
  };

  it("lists only files that exist", () => {
    const missing = CONVERTED_FILES.filter((f) => !FILES.some((x) => x.path === f));
    expect(missing, report("Converted-file entries with no file:", missing)).toEqual([]);
  });

  it("has no direct read of an access table in a converted file", () => {
    const offenders: string[] = [];
    for (const path of CONVERTED_FILES) {
      const f = FILES.find((x) => x.path === path);
      if (!f) continue;
      const lines = f.text.split("\n");
      for (const n of ACCESS_TABLE_READS(f.text)) {
        offenders.push(`${path}:${n} — ${(lines[n - 1] ?? "").trim()}`);
      }
    }
    expect(
      offenders,
      report("Converted file decides access itself — call the database function instead:", offenders),
    ).toEqual([]);
  });

  /** Comments are prose, not behaviour — judge the code only. */
  const stripComments = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const isEntryPoint = (path: string) =>
    /\.functions\.tsx?$/.test(path) || path.startsWith("src/routes/");

  /**
   * Entry points — the files a browser can actually call. Phase 4 final form:
   * no exemption list. A privileged step must follow a registered database
   * authorisation call in the same file.
   */
  it("never reaches supabaseAdmin in a converted entry point without a registered DB authorisation call", () => {
    const offenders: string[] = [];
    const names = [...REGISTERED_DB_AUTH_CALLS, ...REGISTERED_DB_AUTH_WRAPPERS];
    for (const path of CONVERTED_FILES) {
      if (!isEntryPoint(path)) continue;
      const f = FILES.find((x) => x.path === path);
      if (!f) continue;
      const code = stripComments(f.text);
      if (!/\bsupabaseAdmin\b/.test(code)) continue;
      const firstAuth = Math.min(
        ...names.map((c) => {
          const i = code.indexOf(c);
          return i < 0 ? Number.POSITIVE_INFINITY : i;
        }),
      );
      const firstAdmin = code.search(/\bsupabaseAdmin\b/);
      if (!Number.isFinite(firstAuth) || firstAdmin < firstAuth)
        offenders.push(`${path} — supabaseAdmin is not preceded by a registered DB authorisation call`);
    }
    expect(offenders, report("Unauthorised privileged access in a converted file:", offenders)).toEqual(
      [],
    );
  });

  /**
   * Helper modules (`*.server.ts`) are not callable from a browser: they only
   * run when an entry point calls them. Ordering inside the module says
   * nothing, so the rule is structural instead, and it is checked rather than
   * exempted: a converted helper module may not be an entry point itself, may
   * not decide access (rule above), and every entry point that imports it must
   * itself be converted — so the caller is always held to the ordering rule.
   */
  it("keeps converted helper modules callable only from converted entry points", () => {
    const offenders: string[] = [];
    const helpers = CONVERTED_FILES.filter((p) => !isEntryPoint(p));
    for (const path of helpers) {
      const f = FILES.find((x) => x.path === path);
      if (!f) continue;
      if (/createServerFn\(/.test(stripComments(f.text)))
        offenders.push(`${path} — a helper module must not declare a server function`);

      const specifier = path.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
      for (const other of FILES) {
        if (other.path === path) continue;
        if (!isEntryPoint(other.path)) continue;
        // Public API routes are registered system contexts, not user paths.
        if (other.path.startsWith("src/routes/api/public/")) continue;
        if (!other.text.includes(specifier)) continue;
        if (!CONVERTED_FILES.includes(other.path))
          offenders.push(
            `${other.path} imports converted helper ${path} — convert the entry point too`,
          );
      }
    }
    expect(
      offenders,
      report("Converted helper module reached from an unconverted entry point:", offenders),
    ).toEqual([]);
  });
});


/**
 * 7. Every path that returns a client's figures records the read (Phase 6).
 *
 * The registry below is the inventory from the Phase 6 plan. The guard is a
 * drift alarm: if a listed path stops calling `logClientDataRead` — or the one
 * writer is bypassed with a raw `xero_data_read` / `client_report_read` insert
 * somewhere else — this test fails, so the posture check can never quietly
 * drift away from the code.
 */
describe("7. reads of client financial data are audited", () => {
  const READ_PATHS = [
    "src/lib/xero/api.server.ts", // live Xero reads (via logXeroRead)
    "src/lib/xero/snapshot-read.server.ts", // stored Xero snapshots
    "src/lib/xero/recon-snapshot.server.ts", // stored reconciliation snapshots
    "src/lib/reports/monthly-report.functions.ts", // stored monthly reports
    "src/lib/reports/report-delivery.server.ts", // public report link
    "src/lib/loan-consolidation.functions.ts", // saved group loan snapshots
  ];

  it("each inventoried read path calls the one read writer", () => {
    const offenders = READ_PATHS.filter((p) => {
      const f = FILES.find((x) => x.path === p);
      if (!f) return true;
      return !/logClientDataRead|logXeroRead/.test(f.text);
    });
    report("read paths not calling logClientDataRead", offenders);
    expect(offenders).toEqual([]);
  });

  it("nothing writes a read action except the one writer", () => {
    const offenders = FILES.filter(
      (f) =>
        /["']xero_data_read["']|["']client_report_read["']/.test(f.text) &&
        !["src/lib/audit/read-keys.ts", "src/lib/audit.functions.ts"].includes(f.path),
    ).map((f) => f.path);
    report("files naming a read action directly", offenders);
    expect(offenders).toEqual([]);
  });
});
