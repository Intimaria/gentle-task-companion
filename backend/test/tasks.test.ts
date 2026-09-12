import { describe, it, expect } from "vitest";
import { createTask, listTasks, updateTaskStatus, deleteTask } from "../src/data/tasks";

function uniqueSub() { return `task-${Math.floor(performance.now() * 1000)}`; }

describe("tasks repository", () => {
  it("creates a task as not_started and lists it", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "regar las plantas");
    expect(t.id).toBeTruthy();
    expect(t.status).toBe("not_started");
    const tasks = await listTasks(sub);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("regar las plantas");
  });

  it("moves a task to in_progress without setting completedAt", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "estirar");
    const upd = await updateTaskStatus(sub, t.id, "in_progress");
    expect(upd?.status).toBe("in_progress");
    expect(upd?.completedAt).toBeUndefined();
    expect(await listTasks(sub, "in_progress")).toHaveLength(1);
  });

  it("completes a task, setting completedAt", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "tomar agua");
    const done = await updateTaskStatus(sub, t.id, "completed");
    expect(done?.status).toBe("completed");
    expect(done?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await listTasks(sub, "completed")).toHaveLength(1);
  });

  it("reverting from completed clears completedAt", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "volver atrás");
    await updateTaskStatus(sub, t.id, "completed");
    const back = await updateTaskStatus(sub, t.id, "in_progress");
    expect(back?.status).toBe("in_progress");
    expect(back?.completedAt).toBeUndefined();
  });

  it("returns null for a non-existent task", async () => {
    expect(await updateTaskStatus(uniqueSub(), "01NONEXISTENT", "completed")).toBeNull();
  });

  it("isolates tasks by user", async () => {
    const a = uniqueSub(); const b = uniqueSub();
    await createTask(a, "solo de a");
    expect(await listTasks(b)).toHaveLength(0);
  });

  it("deletes a task so it no longer appears in the list", async () => {
    const sub = uniqueSub();
    const t = await createTask(sub, "tarea a borrar");
    await deleteTask(sub, t.id);
    expect(await listTasks(sub)).toHaveLength(0);
  });
});
