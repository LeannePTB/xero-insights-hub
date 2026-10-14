/**
 * Guard: the card catalogue may never offer a card this app cannot draw.
 *
 * Why this exists. `bank_reconciliation` and `tax_liability` sat in the
 * database's card groups for months. Staff could tick them, the tick was stored,
 * and no card ever appeared — the same shape of fault as an expense account
 * tagged Fixed that the break-even calculation ignored, and the pay-run
 * mismatch: the app accepted a choice and silently did nothing with it. Both
 * keys were removed on 20 September 2026 (Tax Liability superseded by the GST
 * activity statement and PAYG Withholding cards, Bank Reconciliation by Uncoded
 * Bankfeed Questions), and this test stops either recurring.
 *
 * How it works. tests/fixtures/card-catalogue.json is a read-only snapshot of
 * app_private.card_group_cards, dumped by scripts/dump-card-catalogue.sh and
 * proved fresh by scripts/check-card-catalogue.sh. The set of cards the app can
 * actually draw is read out of the dashboard source itself — every
 * `widgets.includes("...")` branch in the client dashboard route, plus the
 * merged-card aliases in src/lib/tiers.ts — so a component that is deleted or
 * never written cannot pass.
 *
 * Both directions are covered:
 *   * a catalogue card with no component FAILS the build;
 *   * a built card missing from the catalogue WARNS, so retained implementation
 *     for a future rebuild cannot sit unofferable without anyone noticing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_WIDGETS, DEPRECATED_WIDGET_ALIASES } from "../src/lib/tiers";

const ROOT = join(import.meta.dirname, "..");
const FIXTURE = process.env["CARD_CATALOGUE_FIXTURE"] ?? "tests/fixtures/card-catalogue.sql";
// Notes renders on the management reports page only (removed from the live
// dashboard 8 Oct 2026), so both routes are scanned for rendered cards.
const DASHBOARD = "src/routes/_authenticated/clients.$clientId.index.tsx";
const REPORTS = "src/routes/_authenticated/clients.$clientId.reports.tsx";

/**
 * Every card key the catalogue offers, in any purchasable group, parsed out of
 * the snapshotted function body (`when 'advisory' then array['...','...']`).
 */
const catalogueSql = readFileSync(join(ROOT, FIXTURE), "utf8");
const offered = [
  ...new Set(
    [...catalogueSql.matchAll(/when\s+'[a-z_]+'\s+then\s+array\[([^\]]*)\]/gi)].flatMap((m) =>
      [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((c) => c[1]!),
    ),
  ),
].sort();

/**
 * Every card key the dashboard has a component branch for. Read from the
 * dashboard source, so this cannot drift from what actually renders.
 */
const dashboard =
  readFileSync(join(ROOT, DASHBOARD), "utf8") + readFileSync(join(ROOT, REPORTS), "utf8");
const rendered = new Set(
  [...dashboard.matchAll(/widgets\.includes\(\s*"([a-z_]+)"\s*\)/g)].map((m) => m[1]!),
);
// Notes renders unconditionally on the management reports page (no
// widgets.includes branch), so the regex above cannot see it.
if (readFileSync(join(ROOT, REPORTS), "utf8").includes("<NotesCard")) rendered.add("notes");

/**
 * A deprecated key draws a card when the card it was merged into is rendered.
 * Derived from the alias table, never a second hardcoded list. Retired aliases
 * may remain implemented but absent from the catalogue while their supporting
 * data and code are retained for a future rebuild.
 */
const drawable = new Set(rendered);
for (const [key, target] of Object.entries(DEPRECATED_WIDGET_ALIASES)) {
  if (target && rendered.has(target)) drawable.add(key);
}

describe("card catalogue", () => {
  it("reads a non-empty catalogue and a non-empty set of dashboard cards", () => {
    expect(offered.length).toBeGreaterThan(0);
    expect(rendered.size).toBeGreaterThan(0);
  });

  it("keeps the retired true break-even key out of every purchasable group", () => {
    expect(offered).not.toContain("true_breakeven");
  });

  it("offers no card the app has no component for", () => {
    const orphans = offered.filter((c) => !drawable.has(c));
    expect(
      orphans,
      `The card catalogue offers cards this app cannot draw:\n${orphans
        .map((c) => `  - ${c} — no widgets.includes("${c}") branch in ${DASHBOARD}`)
        .join(
          "\n",
        )}\nEither build the card, or remove the key from app_private.card_group_cards and every client's ticked list in an audited migration.`,
    ).toEqual([]);
  });

  it("keeps ALL_WIDGETS in step with the catalogue", () => {
    const missing = offered.filter((c) => !(ALL_WIDGETS as readonly string[]).includes(c));
    expect(
      missing,
      `Offered cards missing from ALL_WIDGETS in src/lib/tiers.ts: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("fails when the dashboard draws a card the catalogue does not offer", () => {
    // Owner decision 14 Oct 2026: a dashboard section may only render a card
    // that is in the catalogue, so the single entitlement rule decides it.
    // Retired aliases render inside their merged card and are exempt.
    const retired = new Set(Object.keys(DEPRECATED_WIDGET_ALIASES));
    const uncatalogued = [...rendered].filter((c) => !offered.includes(c) && !retired.has(c)).sort();
    expect(uncatalogued, `Dashboard cards missing from the catalogue: ${uncatalogued.join(", ")}`).toEqual([]);
  });

  it("renders every dashboard card component only inside a widgets.includes(<catalogued card>) guard", () => {
    const src = readFileSync(join(ROOT, DASHBOARD), "utf8");
    const components = [
      ...src.matchAll(/import\s+\{\s*([A-Za-z]+(?:Widget|Card))\b[^}]*\}\s+from\s+"@\/components\/dashboard\//g),
    ].map((m) => m[1]!);
    expect(components.length).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const name of components) {
      for (const use of src.matchAll(new RegExp(`<${name}\\b`, "g"))) {
        const at = use.index!;
        const key = guardingCard(src, at);
        if (!key) problems.push(`<${name}> at offset ${at} renders with no widgets.includes guard`);
        else if (!offered.includes(key)) problems.push(`<${name}> is guarded by "${key}", which the catalogue does not offer`);
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * The card key of the innermost `if (... widgets.includes("key") ...)` whose
 * body contains `at`, or null. Bracket-balanced scan; strings are ignored
 * well enough for this source (no brackets inside the guard strings).
 */
function guardingCard(src: string, at: number): string | null {
  const ifRe = /\bif\s*\(/g;
  let best: { start: number; key: string } | null = null;
  for (const m of src.matchAll(ifRe)) {
    const start = m.index!;
    if (start >= at) break;
    // Condition: from the "(" to its matching ")".
    let i = start + m[0].length - 1;
    let depth = 0;
    let condEnd = -1;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth === 0) { condEnd = i; break; } }
    }
    if (condEnd < 0 || condEnd >= at) continue;
    const cond = src.slice(start, condEnd + 1);
    const key = /widgets\.includes\(\s*"([a-z_]+)"\s*\)/.exec(cond)?.[1];
    if (!key) continue;
    // Body: a { block } or a single statement ending at ";" at depth 0.
    let j = condEnd + 1;
    while (/\s/.test(src[j]!)) j++;
    let end = -1;
    depth = 0;
    if (src[j] === "{") {
      for (let k = j; k < src.length; k++) {
        if (src[k] === "{") depth++;
        else if (src[k] === "}") { depth--; if (depth === 0) { end = k; break; } }
      }
    } else {
      for (let k = j; k < src.length; k++) {
        const ch = src[k];
        if (ch === "(" || ch === "{" || ch === "[") depth++;
        else if (ch === ")" || ch === "}" || ch === "]") depth--;
        else if (ch === ";" && depth === 0) { end = k; break; }
      }
    }
    if (end > at && (!best || start > best.start)) best = { start, key };
  }
  return best?.key ?? null;
}
