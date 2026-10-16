import { describe, expect, it } from "bun:test";
import { sameDaysPreviousMonth, paydayNote } from "./pnl-comparison";
const d = (s: string) => new Date(`${s}T00:00:00`);
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
describe("P&L comparison range", () => {
  it("1–16 Oct compares with 1–16 Sep", () => {
    const r = sameDaysPreviousMonth(d("2026-10-01"), d("2026-10-16"));
    expect([iso(r.from), iso(r.to)]).toEqual(["2026-09-01", "2026-09-16"]);
  });
  it("a full month compares with the whole previous month", () => {
    const r = sameDaysPreviousMonth(d("2026-09-01"), d("2026-09-30"));
    expect([iso(r.from), iso(r.to)]).toEqual(["2026-08-01", "2026-08-31"]);
  });
  it("1–30 Mar clamps into February", () => {
    const r = sameDaysPreviousMonth(d("2026-03-01"), d("2026-03-30"));
    expect(iso(r.to)).toBe("2026-02-28");
  });
  it("payday note only when counts differ", () => {
    expect(paydayNote(3, 2)).toBe("3 paydays this period vs 2 in the comparison — wages and super aren't like for like.");
    expect(paydayNote(2, 2)).toBeNull();
    expect(paydayNote(3, null)).toBeNull();
  });
});
