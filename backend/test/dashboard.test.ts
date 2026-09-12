import { describe, it, expect } from "vitest";
import { getDashboard } from "../src/data/dashboard";
import { createMood } from "../src/data/moods";
import { createTask, updateTaskStatus } from "../src/data/tasks";
import { createGratitude } from "../src/data/gratitudes";
import { putProfile } from "../src/data/profile";

function uniqueSub() { return `dash-${Math.floor(performance.now() * 1000)}`; }

describe("getDashboard", () => {
  it("assembles profile, moods, tasks, gratitudes and stats in one view", async () => {
    const sub = uniqueSub();
    await putProfile(sub, { preferredSpecies: "cat", locale: "es" });
    await createMood(sub, { mood: "tranquila" });
    const t1 = await createTask(sub, "abrir la ventana");
    const t2 = await createTask(sub, "estirar");
    await updateTaskStatus(sub, t2.id, "completed");
    await createGratitude(sub, "un té caliente");

    const d = await getDashboard(sub);
    expect(d.profile.preferredSpecies).toBe("cat");
    expect(d.moods).toHaveLength(1);
    expect(d.tasks.open).toHaveLength(1);
    expect(d.tasks.done).toHaveLength(1);
    expect(d.gratitudes).toHaveLength(1);
    expect(d.stats.tasksDone).toBe(1);
    expect(d.stats.streakDays).toBeGreaterThanOrEqual(1);
  });

  it("returns empty structures for a new user", async () => {
    const d = await getDashboard(uniqueSub());
    expect(d.profile).toEqual({});
    expect(d.moods).toEqual([]);
    expect(d.tasks).toEqual({ open: [], done: [] });
    expect(d.gratitudes).toEqual([]);
    expect(d.stats.tasksDone).toBe(0);
    expect(d.stats.streakDays).toBe(0);
  });
});
