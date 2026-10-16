import { createFileRoute } from "@tanstack/react-router";
import { ReportHealthChecks } from "@/components/reports/ReportHealthChecks";
import type { HealthChecks } from "@/lib/health/health-checks";

export const Route = createFileRoute("/health-tile-preview")({ component: Page });

const payload: HealthChecks = {
  headline: "2 of 3 on track",
  fyLabel: "FY26–27",
  asOf: "16 Oct 2026",
  source: { label: "Saved figures", at: "16 Oct 2026" },
  checks: [
    { key: "profit", question: "Making money?", figure: "$19,205", detail: "8.9% margin this financial year", status: "green", meaning: "Net profit for the financial year to date." },
    { key: "cash_cover", question: "Cash cover", figure: "1.4 months", detail: "Cash plus recent debtors vs average monthly costs", status: "watch", meaning: "How long cash and money owed to you would cover costs." },
    { key: "paying_on_time", question: "Customers paying on time?", figure: "$248,500 late", detail: "53% of recent invoice value is 14+ days overdue", status: "red", meaning: "Whether recent invoices are being paid on time." },
  ],
  info: [{ key: "tax", text: "Next tax payment: $3,000 due 21 Oct" }],
} as HealthChecks;

function Page() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <ReportHealthChecks checks={payload} />
    </div>
  );
}
