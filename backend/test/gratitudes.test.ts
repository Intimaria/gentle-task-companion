import { describe, it, expect } from "vitest";
import { createGratitude, listGratitudes, deleteGratitude } from "../src/data/gratitudes";

function uniqueSub() { return `grat-${Math.floor(performance.now() * 1000)}`; }

describe("gratitudes repository", () => {
  it("creates and lists a gratitude", async () => {
    const sub = uniqueSub();
    const g = await createGratitude(sub, "el sol de la mañana");
    expect(g.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const list = await listGratitudes(sub);
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("el sol de la mañana");
  });

  it("lists most-recent first", async () => {
    const sub = uniqueSub();
    await createGratitude(sub, "uno", "2026-08-01T10:00:00.000Z");
    await createGratitude(sub, "dos", "2026-08-02T10:00:00.000Z");
    const list = await listGratitudes(sub);
    expect(list.map((g) => g.text)).toEqual(["dos", "uno"]);
  });

  it("deletes a gratitude so it no longer appears in the list", async () => {
    const sub = uniqueSub();
    const { createdAt } = await createGratitude(sub, "el aire fresco");
    await deleteGratitude(sub, createdAt);
    expect(await listGratitudes(sub)).toHaveLength(0);
  });
});
