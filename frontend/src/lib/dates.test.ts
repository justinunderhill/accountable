import { describe, expect, it } from "vitest";
import { addDays, followUpState, isLate } from "./dates";
import { formatDate, formatShortDate } from "./format";

const TODAY = "2026-11-21";

describe("isLate", () => {
  it("is late only after the close date, for open deals", () => {
    expect(isLate("proposal", "2026-11-20", TODAY)).toBe(true);
    expect(isLate("proposal", "2026-11-21", TODAY)).toBe(false);
    expect(isLate("proposal", "2026-11-22", TODAY)).toBe(false);
  });
  it("never counts Won or Lost as late", () => {
    expect(isLate("won", "2020-01-01", TODAY)).toBe(false);
    expect(isLate("lost", "2020-01-01", TODAY)).toBe(false);
  });
});

describe("followUpState", () => {
  it("is overdue before today", () => {
    expect(followUpState("2026-11-20", false, TODAY)).toBe("overdue");
  });
  it("is coming up from today to 7 days from today, inclusive", () => {
    expect(followUpState("2026-11-21", false, TODAY)).toBe("coming_up");
    expect(followUpState("2026-11-28", false, TODAY)).toBe("coming_up");
    expect(followUpState("2026-11-29", false, TODAY)).toBe("later");
  });
  it("is done once done, whatever the date", () => {
    expect(followUpState("2026-11-01", true, TODAY)).toBe("done");
  });
  it("counts across a month end", () => {
    expect(followUpState("2026-12-05", false, "2026-11-28")).toBe("coming_up");
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
  });
});

describe("date strings never shift by a day", () => {
  it("formats the same day in a timezone behind UTC", () => {
    // Node applies a change to TZ straight away, and Vitest runs each file in its own worker.
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(new Date(2026, 10, 21).getTimezoneOffset()).toBeGreaterThan(0);
      expect(formatDate("2026-11-21")).toBe("Nov 21, 2026");
      expect(formatShortDate("2026-12-01")).toBe("Dec 1");
      expect(addDays("2026-11-21", 0)).toBe("2026-11-21");
      // What plain `new Date("2026-11-21")` would have done: read as UTC, shown a day early.
      expect(new Date("2026-11-21").getDate()).toBe(20);
    } finally {
      process.env.TZ = original;
    }
  });
});
