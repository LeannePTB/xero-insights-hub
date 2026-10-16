import { describe, expect, it } from "vitest";
import { nationalPublicHolidays, paydaySuperDueDate, paydaySuperStatus } from "../src/lib/payday-super";

describe("seven business days after payday", () => {
  it("skips weekends: owner example 16 October to 27 October 2026", () => {
    expect(paydaySuperDueDate("2026-10-16")).toBe("2026-10-27");
  });
  it("crosses a month end", () => {
    expect(paydaySuperDueDate("2026-10-30")).toBe("2026-11-10");
  });
  it("skips Christmas, observed Boxing Day and New Year across year end", () => {
    expect(paydaySuperDueDate("2026-12-24")).toBe("2027-01-07");
  });
  it("skips Good Friday and Easter Monday", () => {
    expect(paydaySuperDueDate("2027-03-25")).toBe("2027-04-07");
  });
  it("skips Australia Day", () => {
    expect(paydaySuperDueDate("2027-01-22")).toBe("2027-02-03");
  });
  it("keeps separate observed Christmas and Boxing Day when both fall on a weekend", () => {
    expect(nationalPublicHolidays(2027).has("2027-12-27")).toBe(true);
    expect(nationalPublicHolidays(2027).has("2027-12-28")).toBe(true);
  });
  it("does not invent a nationally observed substitute ANZAC day", () => {
    expect(nationalPublicHolidays(2027).has("2027-04-25")).toBe(true);
    expect(nationalPublicHolidays(2027).has("2027-04-26")).toBe(false);
  });
  it("rejects invalid calendar dates", () => {
    expect(() => paydaySuperDueDate("2026-02-30")).toThrow();
  });
  it("uses calendar days remaining", () => {
    expect(paydaySuperStatus("2026-10-27", "2026-10-16")).toEqual({ text: "Due in 11 days", overdue: false });
  });
  it("recognises due today", () => {
    expect(paydaySuperStatus("2026-10-27", "2026-10-27")).toEqual({ text: "Due today", overdue: false });
  });
  it("recognises overdue calendar days", () => {
    expect(paydaySuperStatus("2026-10-27", "2026-10-30")).toEqual({ text: "Overdue by 3 days", overdue: true });
  });
});
import { paydaySuperFlag } from "../src/lib/payday-super";
describe("paydaySuperFlag", () => {
  it("flags only overdue and due-today", () => {
    expect(paydaySuperFlag("2026-10-27", "2026-10-28")).toBe("Overdue");
    expect(paydaySuperFlag("2026-10-27", "2026-10-27")).toBe("Due today");
    expect(paydaySuperFlag("2026-10-27", "2026-10-16")).toBeNull();
  });
});
