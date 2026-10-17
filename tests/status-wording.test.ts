import { describe, it, expect } from "vitest";
import { STATUS_LABEL } from "@/lib/health/health-checks";
import { billTone } from "@/components/dashboard/status-tone";

describe("status wording and tax tile colours", () => {
  it("uses Good / Monitor / Alert / No data", () => expect(STATUS_LABEL).toEqual({ green: "Good", watch: "Monitor", red: "Alert", na: "No data" }));
  it("paid is Good, overdue is Alert, not due and due today are Monitor", () => {
    expect([billTone("paid"), billTone("overdue"), billTone("not_due"), billTone("due_today")]).toEqual(["green", "red", "watch", "watch"]);
  });
});
