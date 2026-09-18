import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBreakevenLines } from "./breakeven-lines";
import { buildClassificationResolver } from "@/lib/cost-classification";

const cogsLines = [
  { name: "Wages & Salaries", amount: 8918.05 },
  { name: "Superannuation", amount: 1067.04 },
];
const expenseLines = [
  { name: "Telephones", amount: 348.29 },
  { name: "Subscriptions AI", amount: 1192.51 },
];
const accounts = [
  { name: "Wages & Salaries", type: "DIRECTCOSTS" },
  { name: "Superannuation", type: "DIRECTCOSTS" },
  { name: "Telephones", type: "OVERHEADS" },
  { name: "Subscriptions AI", type: "EXPENSE" },
];

function split(stored: { account_name: string; classification: "fixed" | "variable" | "excluded" }[]) {
  const resolver = buildClassificationResolver({ stored, accounts });
  return classifyBreakevenLines({
    expenseLines,
    cogsLines,
    totalExpenses: 1540.8,
    totalCostOfSales: 9985.09,
    resolve: (n) => resolver.resolve(n),
    classificationEnabled: true,
  });
}

// The assertion whose absence let the defect ship.
test("a cost-of-sales account tagged Fixed lands in fixed costs", () => {
  const s = split([
    { account_name: "Wages & Salaries", classification: "fixed" },
    { account_name: "Superannuation", classification: "fixed" },
    { account_name: "Telephones", classification: "fixed" },
  ]);
  const fixedNames = s.fixedLines.map((l) => l.name);
  assert.ok(fixedNames.includes("Wages & Salaries"));
  assert.ok(fixedNames.includes("Superannuation"));
  assert.equal(Math.round(s.fixedTotal * 100) / 100, 8918.05 + 1067.04 + 348.29);
  assert.equal(
    s.fixedLines.find((l) => l.name === "Wages & Salaries")!.section,
    "cogs",
  );
  // Variable now holds only the variable opex line.
  assert.equal(Math.round(s.variableTotal * 100) / 100, 1192.51);
});

test("an untagged cost-of-sales line stays variable", () => {
  const s = split([]);
  const variableNames = s.variableLines.map((l) => l.name);
  assert.ok(variableNames.includes("Wages & Salaries"));
  assert.ok(variableNames.includes("Superannuation"));
  assert.equal(Math.round(s.variableTotal * 100) / 100, 9985.09 + 1192.51);
  assert.equal(s.cogsUnitemisedBalance, 0);
});

test("a cost-of-sales line with no Xero type and no tag still defaults to variable", () => {
  const resolver = buildClassificationResolver({ stored: [], accounts: [] });
  const s = classifyBreakevenLines({
    expenseLines: [{ name: "Something", amount: 100 }],
    cogsLines: [{ name: "Untyped cost", amount: 500 }],
    totalExpenses: 100,
    totalCostOfSales: 500,
    resolve: (n) => resolver.resolve(n),
    classificationEnabled: true,
  });
  assert.equal(s.variableTotal, 500);
  assert.equal(s.fixedTotal, 100);
  assert.equal(s.unclassifiedCount, 1);
});

test("an excluded cost-of-sales line is excluded from both totals", () => {
  const s = split([{ account_name: "Superannuation", classification: "excluded" }]);
  assert.equal(s.excludedCount, 1);
  assert.equal(Math.round(s.excludedTotal * 100) / 100, 1067.04);
  assert.ok(!s.fixedLines.some((l) => l.name === "Superannuation"));
  assert.ok(!s.variableLines.some((l) => l.name === "Superannuation"));
});

test("cost-of-sales lines that do not sum to the reported total leave a visible plug", () => {
  const resolver = buildClassificationResolver({ stored: [], accounts: [] });
  const s = classifyBreakevenLines({
    expenseLines: [{ name: "Rent", amount: 100 }],
    cogsLines: [{ name: "Materials", amount: 400 }],
    totalExpenses: 100,
    totalCostOfSales: 500,
    resolve: (n) => resolver.resolve(n),
    classificationEnabled: true,
  });
  assert.equal(s.cogsUnitemisedBalance, 100);
  assert.equal(s.variableTotal, 500);
});

test("classification switched off keeps the old behaviour", () => {
  const resolver = buildClassificationResolver({ stored: [], accounts, enabled: false });
  const s = classifyBreakevenLines({
    expenseLines,
    cogsLines,
    totalExpenses: 1540.8,
    totalCostOfSales: 9985.09,
    resolve: (n) => resolver.resolve(n),
    classificationEnabled: false,
  });
  assert.equal(s.fixedTotal, 1540.8);
  assert.equal(s.variableTotal, 9985.09);
});
