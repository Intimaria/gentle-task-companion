import { describe, it, expect } from "vitest";
import { computeStreak } from "../src/data/streak";

describe("computeStreak", () => {
  it("is 0 with no days", () => {
    expect(computeStreak([], "2026-08-04")).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-08-04", "2026-08-03", "2026-08-02"], "2026-08-04")).toBe(3);
  });
  it("counts a streak ending yesterday (grace) ", () => {
    expect(computeStreak(["2026-08-03", "2026-08-02"], "2026-08-04")).toBe(2);
  });
  it("stops at a gap", () => {
    expect(computeStreak(["2026-08-04", "2026-08-01"], "2026-08-04")).toBe(1);
  });
  it("dedupes multiple entries on the same day", () => {
    expect(computeStreak(["2026-08-04", "2026-08-04", "2026-08-03"], "2026-08-04")).toBe(2);
  });
});
