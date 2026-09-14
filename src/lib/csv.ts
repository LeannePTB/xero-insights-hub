// The ONE place a CSV cell is escaped. Every export must use it — a static
// guard in tests/static-guards.test.ts fails the build on a new CSV writer
// that builds cells itself.
//
// Two separate problems are handled here:
//
//  1. CSV quoting — a cell containing a comma, a quote or a newline has to be
//     wrapped in quotes with inner quotes doubled, or the file mis-parses.
//  2. Formula injection — a cell that starts with `=`, `+`, `-`, `@`, a tab or
//     a carriage return is executed as a formula by Excel, Sheets and Numbers.
//     `=HYPERLINK(...)`, `=cmd|...` and `=WEBSERVICE(...)` turn an exported
//     audit trail into an attack on whoever opens it. The cell is prefixed with
//     a single quote so the spreadsheet treats it as text; the value a person
//     reads is unchanged.

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** One CSV cell: formula-neutralised, then quoted when it needs to be. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (FORMULA_LEAD.test(s)) s = `'${s}`;
  return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole CSV document from a header row plus data rows. */
export function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\n");
}
