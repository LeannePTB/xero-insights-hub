import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogueGuideText, defaultCardsFromModules, moduleState, type CardCatalogue } from "../src/lib/cards/catalogue";

const catalogue: CardCatalogue = {
  modules: [
    { key: "cash_flow", label: "Cash flow", description: "" },
    { key: "profit", label: "Profit", description: "" },
    { key: "tax_compliance", label: "Tax & compliance", description: "" },
    { key: "bookkeeping_checks", label: "Bookkeeping checks", description: "" },
  ],
  cards: [
    ...["health", "receivables", "payables", "pnl", "notes"].map((k) => ({ key: k, package: "standard" as const, module: null, label: k, description: "" })),
    { key: "cashflow", package: "advisory", module: "cash_flow", label: "Cash flow", description: "" },
    { key: "cashflow_scenario", package: "advisory", module: "cash_flow", label: "Scenario", description: "" },
    { key: "accounting_breakeven", package: "advisory", module: "profit", label: "Break-even", description: "" },
    { key: "loan_consolidation", package: "consolidation", module: null, label: "Loans", description: "" },
  ],
};

describe("Advisory modules", () => {
  it("shows a module ticked only when all its cards are on, partial when some are", () => {
    expect(moduleState(["cashflow", "cashflow_scenario"], new Set(["cashflow", "cashflow_scenario"]))).toBe("on");
    expect(moduleState(["cashflow", "cashflow_scenario"], new Set(["cashflow"]))).toBe("partial");
    expect(moduleState(["cashflow", "cashflow_scenario"], new Set(["health"]))).toBe("off");
  });

  it("always includes Standard in an organisation's default modules", () => {
    expect(defaultCardsFromModules(catalogue, [], false)).toEqual(["health", "notes", "payables", "pnl", "receivables"]);
  });

  it("adds a module's cards and Consolidation only when ticked", () => {
    const cards = defaultCardsFromModules(catalogue, ["cash_flow"], true);
    expect(cards).toContain("cashflow_scenario");
    expect(cards).toContain("loan_consolidation");
    expect(cards).not.toContain("accounting_breakeven");
  });

  it("seeds the four modules with the owner's card lists", () => {
    const sql = readFileSync("drizzle/migrations/0038_card_catalogue_and_modules.sql", "utf8");
    const mod = (card: string) => sql.match(new RegExp(`\\('${card}', '(\\w+)', (null|'(\\w+)')`))?.slice(1, 4);
    expect(mod("cashflow")?.[2]).toBe("cash_flow");
    expect(mod("cashflow_scenario")?.[2]).toBe("cash_flow");
    expect(mod("accounting_breakeven")?.[2]).toBe("profit");
    for (const c of ["tax_obligations", "gst_reconciliation", "superannuation", "payg_withholding"]) expect(mod(c)?.[2]).toBe("tax_compliance");
    for (const c of ["xero_audit", "transaction_search"]) expect(mod(c)?.[2]).toBe("bookkeeping_checks");
    expect(mod("loan_consolidation")?.[0]).toBe("consolidation");
    for (const c of ["health", "receivables", "payables", "pnl", "notes"]) expect(mod(c)?.[0]).toBe("standard");
  });

  it("builds Trixie's package text from the catalogue", () => {
    const text = catalogueGuideText(catalogue);
    expect(text).toContain('Advisory module "Cash flow"');
    expect(text).toContain("Staff cannot change them");
  });
});
