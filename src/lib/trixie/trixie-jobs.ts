/** Ready-made Trixie jobs: fixed prompt + fixed read-only tool set, staff on a client page only. */
export const TRIXIE_JOBS = {
  meeting_brief: {
    label: "Meeting brief",
    prompt: "Prepare a one-page meeting brief for this client: the three health checks, what is due to the ATO and for super (amounts and dates), who owes them money (top customers and overdue), what changed since last month, then three talking points. Use headings and short bullets.",
    tools: ["readHealthVerdict", "readCurrentClientFigures", "readTaxObligations", "readReceivables", "pay_runs", "activity_statement", "compare_periods", "contact_history"],
  },
  report_commentary: {
    label: "Report commentary draft",
    prompt: "Draft plain-English commentary paragraphs for this client's monthly report: performance, cash, tax and what to watch next month. Write 3–5 short paragraphs the adviser can copy. Do not mention that it is a draft inside the text.",
    tools: ["readProfitAndLoss", "readCashPosition", "readTaxObligations", "readReceivables", "compare_periods", "readHealthVerdict"],
  },
  bas_sense_check: {
    label: "BAS sense-check",
    prompt: "Do a BAS sense-check for this client: this period's GST (1A, 1B) and PAYG (W1, W2) against last period and the same period last year, unfiled amounts, the GST account versus period GST, and anything unusual to check before lodging. Use a short table, then bullets.",
    tools: ["activity_statement", "pay_runs", "find_issues", "account_transactions"],
  },
} as const;

export type TrixieJobKey = keyof typeof TRIXIE_JOBS;
export const isTrixieJob = (v: unknown): v is TrixieJobKey => typeof v === "string" && Object.prototype.hasOwnProperty.call(TRIXIE_JOBS, v);
