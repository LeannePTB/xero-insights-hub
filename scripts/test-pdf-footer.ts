import { renderMonthlyReportPdf } from "@/lib/reports/report-pdf.server";
import type { MonthlyReportPayload } from "@/lib/reports/monthly-report";
import { writeFileSync } from "fs";

const payload: MonthlyReportPayload = {
  payloadVersion: 6,
  complete: true,
  failedSections: [],
  meta: {
    organisationName: "Positive Traction",
    clientName: "Autotek NSW",
    tenantName: "Autotek NSW",
    tenantId: "tenant-123",
    periodEnd: "2026-07-31",
    monthStart: "2026-07-01",
    monthLabel: "Jul 2026",
    fyStart: "2025-08-01",
    fyLabel: "FY26",
    priorFyLabel: "FY25",
    currency: "AUD",
    generatedAt: "2026-08-24",
  },
  notes: [],
  keyFigures: [],
  profitAndLoss: {
    monthLabel: "Jul 2026",
    priorMonthLabel: "Jun 2026",
    fyLabel: "FY26",
    lines: [],
    totals: {
      revenue: 0,
      otherIncome: 0,
      costOfSales: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
      netMargin: 0,
    },
  },
  receivables: {
    asAt: "2026-07-31",
    bucketLabels: ["Current", "31-60", "61-90", "90+"],
    rows: [],
    totals: [0, 0, 0, 0],
    total: 0,
    caveat: "",
  },
  payables: {
    asAt: "2026-07-31",
    bucketLabels: ["Current", "31-60", "61-90", "90+"],
    rows: [],
    totals: [0, 0, 0, 0],
    total: 0,
    caveat: "",
  },
  disclaimer: undefined,
};

const bytes = renderMonthlyReportPdf({
  payload,
  status: "draft",
  version: 1,
  title: "Monthly Management Report",
  orgLogo: null,
  clientLogo: null,
});

writeFileSync("/tmp/report-footer-test.pdf", bytes);
console.log("Wrote /tmp/report-footer-test.pdf");
