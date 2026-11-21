import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatMoney,
  formatMoneyShort,
  formatMonth,
  formatShortDate,
  initials,
} from "./format";

describe("formatMoney", () => {
  it("shows whole dollars with commas", () => {
    expect(formatMoney(1_250_000)).toBe("$12,500");
    expect(formatMoney(15_000_000)).toBe("$150,000");
  });
  it("shows zero as $0", () => {
    expect(formatMoney(0)).toBe("$0");
  });
});

describe("formatMoneyShort", () => {
  it("shortens thousands and millions", () => {
    expect(formatMoneyShort(4_000_000)).toBe("$40k");
    expect(formatMoneyShort(120_000_000)).toBe("$1.2M");
    expect(formatMoneyShort(300_000_000)).toBe("$3M");
  });
  it("keeps $0 and small amounts", () => {
    expect(formatMoneyShort(0)).toBe("$0");
    expect(formatMoneyShort(85_000)).toBe("$850");
  });
  it("rolls over to millions rather than showing $1000k", () => {
    expect(formatMoneyShort(99_960_000)).toBe("$1M");
  });
});

describe("US date formats", () => {
  it("formats dates, short dates and times", () => {
    expect(formatDate("2026-11-21")).toBe("Nov 21, 2026");
    expect(formatShortDate("2026-11-21")).toBe("Nov 21");
    expect(formatDateTime("2026-11-19T14:30:00")).toBe("Nov 19, 2026, 2:30 PM");
    expect(formatLongDate("2026-11-21")).toBe("Saturday, November 21");
  });
  it("formats months", () => {
    expect(formatMonth("2026-03")).toBe("Mar");
    expect(formatMonth("2025-12", true)).toBe("December 2025");
  });
});

describe("small helpers", () => {
  it("counts with the right plural", () => {
    expect(formatCount(1, "deal")).toBe("1 deal");
    expect(formatCount(3, "deal")).toBe("3 deals");
    expect(formatCount(2, "activity", "activities")).toBe("2 activities");
  });
  it("makes initials", () => {
    expect(initials("Maria Lopez")).toBe("ML");
    expect(initials("Cher")).toBe("C");
    expect(initials("Anna de la Cruz")).toBe("AC");
  });
});
