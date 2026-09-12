import { describe, it, expect } from "vitest";
import { createMood, listMoods, deleteMood } from "../src/data/moods";

function uniqueSub() {
  return `test-${Math.floor(performance.now() * 1000)}`;
}

describe("moods repository", () => {
  it("creates a mood and lists it back", async () => {
    const sub = uniqueSub();
    const { createdAt } = await createMood(sub, { mood: "tranquila" });
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const moods = await listMoods(sub);
    expect(moods).toHaveLength(1);
    expect(moods[0].mood).toBe("tranquila");
    expect(moods[0].createdAt).toBe(createdAt);
  });

  it("returns moods most-recent first", async () => {
    const sub = uniqueSub();
    await createMood(sub, { mood: "ansiosa", createdAt: "2026-08-03T10:00:00.000Z" });
    await createMood(sub, { mood: "tranquila", createdAt: "2026-08-03T20:00:00.000Z" });

    const moods = await listMoods(sub);
    expect(moods.map((m) => m.mood)).toEqual(["tranquila", "ansiosa"]);
  });

  it("isolates moods by user", async () => {
    const a = uniqueSub();
    const b = uniqueSub();
    await createMood(a, { mood: "feliz" });
    expect(await listMoods(b)).toHaveLength(0);
  });

  it("deletes a mood so it no longer appears in the list", async () => {
    const sub = uniqueSub();
    const { createdAt } = await createMood(sub, { mood: "cansada" });
    await deleteMood(sub, createdAt);
    expect(await listMoods(sub)).toHaveLength(0);
  });
});
