// Client-safe type re-exports for the rules-engine verdict (Overview badge).
// The former client-list verdict server function was replaced by the Business
// Health checks (`listClientHealthChecks` in `src/lib/health.functions.ts`).
export type { Verdict, Finding, RuleSeverity } from "./rules.server";
