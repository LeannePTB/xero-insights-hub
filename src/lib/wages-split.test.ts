import { describe, expect, it } from "vitest";
import { splitWages, wageAccountNames, wagesFromSections } from "./wages-split";

// Figures shaped like the stored Demo Company and Positive Traction P&Ls.
const demo = { income: 41_200, costOfSales: 10_353, expenses: 22_480, cogsLines: [{ name: "Direct Wages", amount: 4_100 }, { name: "Materials", amount: 6_253 }], expenseLines: [{ name: "Wages and Salaries", amount: 9_300 }, { name: "Rent", amount: 13_180 }] };
const pt = { income: 28_600, costOfSales: 0, expenses: 18_500, cogsLines: [], expenseLines: [{ name: "Wages", amount: 13_434 }, { name: "Software", amount: 5_066 }] };
const totals = (p: typeof demo | typeof pt, names: Set<string>) => {
  const w = splitWages(p, names);
  const gross = p.income - (w.costOfSalesExWages + (w.split ? p.costOfSales - w.costOfSalesExWages : 0));
  const net = gross - (w.overheadsExWages + (w.split ? p.expenses - w.overheadsExWages : 0));
  return { w, gross, net };
};

describe("wages split", () => {
  it("Demo Company: gross and net profit unchanged before/after", () => {
    const { w, gross, net } = totals(demo, wageAccountNames([{ account_name: "Direct Wages", is_wages: true }, { account_name: "Wages and Salaries", is_wages: true }]));
    expect(gross).toBe(41_200 - 10_353);
    expect(net).toBe(41_200 - 10_353 - 22_480);
    expect(w.costOfSalesExWages + w.wages + w.overheadsExWages).toBe(10_353 + 22_480);
  });
  it("Positive Traction: wages $13,434, overheads $5,066, net unchanged", () => {
    const { w, net } = totals(pt, wageAccountNames([{ account_name: "Wages", classification: "wages" }]));
    expect(w.wages).toBe(13_434);
    expect(w.overheadsExWages).toBe(5_066);
    expect(net).toBe(28_600 - 18_500);
  });
  it("wages in cost of sales and operating are summed once", () => {
    const w = splitWages(demo, wageAccountNames([{ account_name: "direct wages ", is_wages: true }, { account_name: "Wages and Salaries", is_wages: true }]));
    expect(w.wages).toBe(13_400);
    expect(w.costOfSalesExWages).toBe(6_253);
    expect(w.overheadsExWages).toBe(13_180);
    expect(w.accountsFound).toBe(2);
  });
  it("no split when nothing is marked", () => {
    const w = splitWages(demo, wageAccountNames([{ account_name: "Rent", classification: "fixed" }]));
    expect(w).toEqual({ split: false, costOfSalesExWages: 10_353, wages: 0, overheadsExWages: 22_480, accountsFound: 0 });
    expect(wagesFromSections([], 0, new Set())).toBeNull();
  });
});
