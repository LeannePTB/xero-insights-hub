/**
 * Static, fictional demo data for the public home page. Never read from the
 * database or Xero. Shapes were taken from a real dashboard, with every name
 * invented and every amount scaled by one factor (×1.35) and rounded, so totals,
 * margins and checks still add up.
 */
import type { HealthChecks } from "@/lib/health/health-checks";
import type { ForwardTax } from "@/components/dashboard/tax-obligations";
import type { ChartPoint } from "@/lib/charts/geometry";

export const DEMO_BUSINESS = "Harbour Studio";
export const DEMO_FILE = "Harbour Studio Pty Ltd";

/** Financial year to date, by month: income, expenses (incl. cost of sales), net profit. */
export const DEMO_PNL_MONTHS: ChartPoint[] = [
  { label: "Jul", values: [34570, 25333, 9237] },
  { label: "Aug", values: [30764, 24488, 6276] },
  { label: "Sep", values: [35334, 24918, 10416] },
  { label: "Oct", values: [18900, 14200, 4700] },
];

/** 1–16 Oct against 1–16 Sep. Gross profit = income − cost of sales; net = gross − expenses. */
export const DEMO_PNL_TILES = {
  currentLabel: "1–16 Oct",
  priorLabel: "1–16 Sep",
  tiles: [
    { label: "Income", value: 18900, previous: 18150, higherIsBetter: true },
    { label: "Cost of Sales", value: 6450, previous: 6120, higherIsBetter: false },
    { label: "Gross Profit", value: 12450, previous: 12030, higherIsBetter: true },
    { label: "Expenses", value: 7750, previous: 7980, higherIsBetter: false },
    { label: "Net Profit", value: 4700, previous: 4050, higherIsBetter: true },
  ],
  note: "3 paydays this period vs 2 in the comparison — wages and super aren't like for like.",
};

export const DEMO_HEALTH: HealthChecks = {
  asOf: "16 Oct 2026",
  fyLabel: "FY 2026–27",
  headline: "1 of 3 on track",
  onTrack: 1,
  counted: 3,
  profitHeldBack: false,
  checks: [
    { key: "profit", question: "Making money?", figure: "$25.9k profit · 25.8% margin", detail: "Income $100.7k · costs $74.7k (Jul–Sep)", status: "green", meaning: "Profitable so far this financial year." },
    { key: "cash_cover", question: "Cash cover", figure: "1.4 months", detail: "Cash $28.6k + recent debtors $6.2k vs $24.8k average monthly costs", status: "watch", meaning: "Enough for now — worth keeping an eye on." },
    { key: "paying_on_time", question: "Customers paying on time?", figure: "62% paid within terms", detail: "Average 19 days late over the last 90 days", status: "red", meaning: "Slow payers are holding up cash." },
  ],
  info: [
    { key: "next_tax", text: "Next tax: $4,050 BAS due 21 Oct" },
    { key: "old_debts", text: "$2,430 owed for more than 90 days" },
  ],
};

export const DEMO_TAX: ForwardTax = {
  owing: [{ amount: 4050, reference: "Sep BAS", due: "2026-10-21", overdue: false }],
  building: { gst: 5420, payg: 2526, total: 7946, due: "2026-11-21", from: "2026-10-01", to: "2026-10-31" },
  instalment: { amount: 1350, due: "2026-10-28" },
  totalToPlan: 13346,
};

export const DEMO_SUPER = {
  outstanding: 1490,
  rows: [
    { payday: "2 Oct 2026", amount: 495, due: "13 Oct 2026", flag: null as string | null },
    { payday: "9 Oct 2026", amount: 495, due: "20 Oct 2026", flag: null },
    { payday: "16 Oct 2026", amount: 500, due: "27 Oct 2026", flag: null },
  ],
};

export const DEMO_BREAKEVEN = { revenue: 33556, target: 26400, monthlyFixed: 17160, margin: 65 };

export const DEMO_OVERVIEW = [
  { name: "Harbour Studio", onTrack: 1, red: true, cash: 28600, next: "$4,050 · 21 Oct", overdue: false, building: "Building ~$7,946 (Nov)" },
  { name: "Saltbush Joinery", onTrack: 3, red: false, cash: 61200, next: "$2,180 · 21 Oct", overdue: false, building: "Building ~$3,420 (Nov)" },
  { name: "Kestrel Physiotherapy", onTrack: 2, red: false, cash: 19450, next: "$3,310 · 28 Oct", overdue: false, building: "Building ~$1,960 (Nov)" },
  { name: "Copperleaf Catering", onTrack: 0, red: true, cash: 4120, next: "$6,870 · 28 Sep", overdue: true, building: "Building ~$5,140 (Oct)" },
  { name: "Northpoint Landscapes", onTrack: 2, red: false, cash: 37800, next: "$1,540 · 21 Oct", overdue: false, building: "Building ~$2,250 (Nov)" },
];
