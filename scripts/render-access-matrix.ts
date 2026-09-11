/**
 * Renders docs/security/access-matrix.md from docs/security/access-matrix.ts.
 *
 *   bun run scripts/render-access-matrix.ts          # write
 *   bun run scripts/render-access-matrix.ts --check  # exit 1 if stale
 *
 * tests/access-matrix.test.ts runs the --check path, so the readable document
 * can never drift from the rules the suites enforce.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { MATRIX, ROLE_LABELS, type MatrixRow, type Role } from "../docs/security/access-matrix";

const OUT = resolve(import.meta.dir, "../docs/security/access-matrix.md");

function cell(v: string) {
  return v.replace(/\|/g, "\\|");
}

function renderRow(r: MatrixRow) {
  const expect = r.expect === "allow" ? "ALLOW" : "DENY";
  const flag = r.knownFailure ? ` **KNOWN FAILURE (backlog ${r.knownFailure.backlog})**` : "";
  const note = [r.note, r.knownFailure?.note].filter(Boolean).join(" ");
  return `| ${cell(r.resource)} | ${r.operation} | ${expect}${flag} | ${r.layers.join(", ")} | ${cell(
    r.rule,
  )} | ${cell(note)} |`;
}

function render() {
  const byRole = new Map<Role, MatrixRow[]>();
  for (const r of MATRIX) byRole.set(r.role, [...(byRole.get(r.role) ?? []), r]);

  const knownFailures = MATRIX.filter((r) => r.knownFailure);

  const lines: string[] = [
    "# Access matrix",
    "",
    "> GENERATED FILE — do not edit. Source of truth: `docs/security/access-matrix.ts`.",
    "> Regenerate with `bun run scripts/render-access-matrix.ts`.",
    "",
    `Rows: **${MATRIX.length}**. Known failures: **${knownFailures.length}**.`,
    "",
    "`ALLOW`/`DENY` is the EXPECTED result. A row marked KNOWN FAILURE describes behaviour that is wrong today:",
    "the suites report it every run with its backlog number and never count it as a pass.",
    "",
    "## Known failures",
    "",
  ];

  if (knownFailures.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| Backlog | Role | Resource | Operation | Why it fails |", "| --- | --- | --- | --- | --- |");
    for (const r of knownFailures)
      lines.push(
        `| ${r.knownFailure!.backlog} | ${ROLE_LABELS[r.role]} | ${cell(r.resource)} | ${r.operation} | ${cell(
          r.knownFailure!.note,
        )} |`,
      );
    lines.push("");
  }

  for (const [role, rs] of byRole) {
    lines.push(
      `## ${ROLE_LABELS[role]}`,
      "",
      "| Resource | Operation | Expected | Layers | Rule | Notes |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rs.map(renderRow),
      "",
    );
  }

  return lines.join("\n");
}

const content = render();

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== content) {
    console.error("access-matrix.md is stale — run: bun run scripts/render-access-matrix.ts");
    process.exit(1);
  }
  console.log("access-matrix.md is up to date.");
} else {
  writeFileSync(OUT, content);
  console.log(`Wrote ${OUT}`);
}
