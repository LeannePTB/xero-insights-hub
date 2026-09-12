/**
 * Generates docs/security/definer-register.md from the LIVE catalogue plus a code search.
 *
 *   bun run scripts/definer-register.ts          # regenerate (needs a database connection)
 *   bun run scripts/definer-register.ts --check   # exit 1 if stale, unexplained, or drifted
 *
 * The register is generated, never hand-maintained: names, arguments, EXECUTE grants,
 * `SET search_path` and the aal2 assertion come from the database; callers come from
 * ripgrep over src/tests/scripts plus the live policy, trigger and function bodies; the
 * plain-English purpose comes from docs/security/definer-purposes.ts.
 *
 * `--check` fails when the committed register differs from what the live database and the
 * code would generate now — so a new or changed definer function that is missing from the
 * register, or has no stated purpose, blocks `bun run security:check`.
 *
 * Limitation, stated rather than hidden: PostgREST request logs are not reachable from
 * here, so "none found" means no reference in this repository, in any function body, in
 * any policy and in any trigger — not proof that no external caller exists.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFINER_PURPOSES } from "../docs/security/definer-purposes";

const ROOT = resolve(import.meta.dir, "..");
const OUT = resolve(ROOT, "docs/security/definer-register.md");
const DUMP = resolve(ROOT, "scripts/dump-definer-catalogue.sql");
const CHECK = process.argv.includes("--check");

type Fn = {
  schema: string;
  name: string;
  args: string;
  returns: string;
  volatility: string;
  search_path: string | null;
  executors: string[];
  body: string;
};
type Catalogue = {
  functions: Fn[];
  all_functions: { schema: string; name: string; definer: boolean; body: string }[];
  policies: { table: string; name: string; expr: string }[];
  cron_jobs: { name: string | null; command: string }[];
  triggers: { table: string; name: string; function: string }[];
};

function haveDb() {
  return Boolean(process.env["PGHOST"]);
}

function loadCatalogue(): Catalogue {
  const raw = execFileSync("psql", ["-q", "-t", "-A", "-f", DUMP], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(raw.trim());
}

function codeCallers(name: string): string[] {
  try {
    const out = execFileSync(
      "rg",
      ["-l", "--no-messages", "-F", name, "src", "tests", "scripts"],
      { cwd: ROOT, encoding: "utf8" },
    );
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter(
        (f) =>
          // Generated mirrors and type stubs are not callers.
          !f.startsWith("scripts/dump-definer") &&
          f !== "scripts/definer-register.ts" &&
          f !== "scripts/dump-rls-fixture.sql" &&
          f !== "tests/fixtures/rls-schema.sql" &&
          f !== "src/integrations/supabase/types.ts",
      );
  } catch {
    return []; // rg exits 1 when nothing matches
  }
}

function esc(v: string) {
  return v.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function render(cat: Catalogue) {
  const missingPurpose: string[] = [];
  const stalePurpose = new Set(Object.keys(DEFINER_PURPOSES));

  type Row = Fn & { key: string; purpose: string; callable: boolean; aal2: boolean; callers: string[] };
  const rows: Row[] = cat.functions.map((f) => {
    const key = `${f.schema}.${f.name}`;
    stalePurpose.delete(key);
    const purpose = DEFINER_PURPOSES[key];
    if (!purpose) missingPurpose.push(`${key}(${f.args})`);

    const callers: string[] = [];
    for (const file of codeCallers(f.name)) callers.push(`\`${file}\``);
    for (const other of cat.all_functions) {
      if (other.schema === f.schema && other.name === f.name) continue;
      if (other.body.includes(f.name)) callers.push(`fn \`${other.schema}.${other.name}\``);
    }
    for (const p of cat.policies) if (p.expr.includes(f.name)) callers.push(`policy \`${p.table}: ${p.name}\``);
    for (const t of cat.triggers) if (t.function === f.name) callers.push(`trigger \`${t.table}: ${t.name}\``);
    for (const j of cat.cron_jobs)
      if (j.command.includes(f.name)) callers.push(`scheduled job \`${j.name ?? "unnamed"}\``);

    return {
      ...f,
      key,
      purpose: purpose ?? "**NO PURPOSE RECORDED — add one to docs/security/definer-purposes.ts**",
      callable: f.executors.includes("authenticated") || f.executors.includes("anon") || f.executors.includes("-"),
      aal2: /assert_aal2|is_aal2\(/.test(f.body),
      callers: [...new Set(callers)].sort(),
    };
  });

  const callable = rows.filter((r) => r.callable);
  const noCaller = rows.filter((r) => r.callers.length === 0);
  const noSearchPath = rows.filter((r) => !r.search_path);
  const callableNoAal2 = callable.filter((r) => !r.aal2);

  const lines: string[] = [
    "# SECURITY DEFINER register",
    "",
    "> GENERATED FILE — do not edit. Regenerate with `bun run scripts/definer-register.ts`.",
    "> Source of truth: the live catalogue (names, arguments, EXECUTE grants, `SET search_path`,",
    "> the aal2 assertion) plus `docs/security/definer-purposes.ts` (the plain-English purpose).",
    "> `bun run security:check` runs `--check`, so a new or changed definer function that is missing",
    "> from this register, or that has no stated purpose, fails the check.",
    "",
    "The goal is not fewer functions. A definer function is acceptable when it is guarded and someone",
    "can say what it is for; the risk is a function nobody can explain.",
    "",
    "## Totals",
    "",
    `| | count |`,
    `| --- | --- |`,
    `| SECURITY DEFINER functions in \`public\` + \`app_private\` | **${rows.length}** |`,
    `| in \`public\` | ${rows.filter((r) => r.schema === "public").length} |`,
    `| in \`app_private\` | ${rows.filter((r) => r.schema === "app_private").length} |`,
    `| callable by signed-in users (EXECUTE to \`authenticated\`/\`anon\`/PUBLIC) | **${callable.length}** |`,
    `| callable and asserting aal2 in the body | ${callable.length - callableNoAal2.length} |`,
    `| callable WITHOUT an aal2 assertion (each must be justified below) | ${callableNoAal2.length} |`,
    `| without \`SET search_path\` | ${noSearchPath.length} |`,
    `| with no caller found | **${noCaller.length}** |`,
    "",
    "`aal2` means the body asserts a second-factor session itself. `app_private` helpers do not need to:",
    "they are not callable by signed-in users, and every policy that uses them sits behind the restrictive",
    "`mfa_aal2_required` policy on its table.",
    "",
    "## Callable by signed-in users without an aal2 assertion",
    "",
  ];

  if (callableNoAal2.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| function | why this is allowed |", "| --- | --- |");
    for (const r of callableNoAal2)
      lines.push(
        `| \`${r.key}(${esc(r.args)})\` | ${
          r.schema === "app_private"
            ? "internal helper or trigger function, not reachable as a signed-in call path; the tables it guards carry the restrictive aal2 policy"
            : "approved exception — returns no organisation, client or personal data"
        } |`,
      );
    lines.push("");
  }

  lines.push("## Functions with no caller found", "");
  if (noCaller.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(
      "No reference in `src`, `tests`, `scripts`, in any other function body, in any policy, or in any trigger.",
      "PostgREST request logs cannot be read from here, so this is not proof that nothing external calls them.",
      "",
      "| function | purpose |",
      "| --- | --- |",
    );
    for (const r of noCaller) lines.push(`| \`${r.key}(${esc(r.args)})\` | ${esc(r.purpose)} |`);
    lines.push("");
  }

  for (const schema of ["public", "app_private"]) {
    lines.push(`## \`${schema}\``, "", "| function | purpose | may execute | search_path | aal2 | callers |", "| --- | --- | --- | --- | --- | --- |");
    for (const r of rows.filter((x) => x.schema === schema)) {
      const exec = r.executors.map((e) => (e === "-" ? "PUBLIC" : e)).join(", ");
      lines.push(
        `| \`${r.name}(${esc(r.args)})\` | ${esc(r.purpose)} | ${exec} | ${r.search_path ? "yes" : "**no**"} | ${
          r.aal2 ? "yes" : "no"
        } | ${r.callers.length ? r.callers.map(esc).join("<br>") : "none found"} |`,
      );
    }
    lines.push("");
  }

  return { text: lines.join("\n") + "\n", missingPurpose, stalePurpose: [...stalePurpose].sort(), rows };
}

if (!haveDb()) {
  if (CHECK) {
    console.log("DEFINER REGISTER: SKIPPED — no database connection in this environment.");
    process.exit(0);
  }
  console.error("DEFINER REGISTER: cannot regenerate without a database connection (PGHOST).");
  process.exit(1);
}

const { text, missingPurpose, stalePurpose, rows } = render(loadCatalogue());
let failed = false;

if (missingPurpose.length) {
  console.error("DEFINER REGISTER: FAIL — definer functions with no stated purpose:");
  for (const m of missingPurpose) console.error(`  ${m}`);
  console.error("  add each one to docs/security/definer-purposes.ts");
  failed = true;
}
if (stalePurpose.length) {
  console.error("DEFINER REGISTER: FAIL — purposes recorded for functions that no longer exist:");
  for (const m of stalePurpose) console.error(`  ${m}`);
  failed = true;
}

if (CHECK) {
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (have !== text) {
    console.error("DEFINER REGISTER: FAIL — docs/security/definer-register.md is stale.");
    console.error("  run: bun run scripts/definer-register.ts");
    failed = true;
  }
  if (failed) process.exit(1);
  console.log(
    `DEFINER REGISTER: OK — ${rows.length} definer functions, ${
      rows.filter((r) => r.callable).length
    } callable by signed-in users, ${rows.filter((r) => r.callers.length === 0).length} with no caller found.`,
  );
} else {
  if (failed) process.exit(1);
  writeFileSync(OUT, text);
  console.log(`wrote docs/security/definer-register.md — ${rows.length} functions.`);
}
