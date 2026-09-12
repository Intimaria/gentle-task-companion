import { describe, it, expect } from "vitest";
import { userPk, moodSk } from "../src/data/table";

describe("table key helpers", () => {
  it("builds the user partition key", () => {
    expect(userPk("abc-123")).toBe("USER#abc-123");
  });

  it("builds a mood sort key from an ISO timestamp", () => {
    expect(moodSk("2026-08-03T14:22:00.000Z")).toBe("MOOD#2026-08-03T14:22:00.000Z");
  });
});
