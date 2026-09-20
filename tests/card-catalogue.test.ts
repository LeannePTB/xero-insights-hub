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
const DASHBOARD = "src/routes/_authenticated/clients.$clientId.index.tsx";

/**
 * Every card key the catalogue offers, in any purchasable group, parsed out of
 * the snapshotted function body (`when 'advisory' then array['...','...']`).
 */
const catalogueSql = readFileSync(join(ROOT, FIXTURE), "utf8");
const offered = [
  ...new Set(
    [...catalogueSql.matchAll(/when\s+'[a-z_]+'\s+then\s+array\[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((c) => c[1]!),
    ),
  ),
].sort();

/**
 * Every card key the dashboard has a component branch for. Read from the
 * dashboard source, so this cannot drift from what actually renders.
 */
const dashboard = readFileSync(join(ROOT, DASHBOARD), "utf8");
const rendered = new Set(
  [...dashboard.matchAll(/widgets\.includes\(\s*"([a-z_]+)"\s*\)/g)].map((m) => m[1]!),
);

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

  it("warns when a built card is not offered anywhere in the catalogue", () => {
    const unofferable = [...drawable].filter((c) => !offered.includes(c)).sort();
    if (unofferable.length) {
      console.warn(
        `WARNING — built cards nobody can tick, because no purchasable group offers them: ${unofferable.join(
          ", ",
        )}. Add each to app_private.card_group_cards, or delete the component.`,
      );
    }
    // Deliberately a warning, not a failure: a finished but unreleased card is a
    // decision, an unofferable card that nobody notices is the fault.
    expect(Array.isArray(unofferable)).toBe(true);
  });
});
