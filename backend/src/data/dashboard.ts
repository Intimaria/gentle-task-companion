import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";
import { computeStreak } from "./streak";
import type { Mood } from "./moods";
import type { Task } from "./tasks";
import type { Gratitude } from "./gratitudes";
import type { Profile } from "./profile";

const doc = makeDocClient();

export interface Dashboard {
  profile: Profile;
  moods: Mood[];
  tasks: { open: Task[]; done: Task[] };
  gratitudes: Gratitude[];
  stats: { tasksDone: number; streakDays: number };
}

/** Una sola Query a la partición del usuario arma toda la vista. */
export async function getDashboard(sub: string, today?: string): Promise<Dashboard> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": userPk(sub) },
  }));
  const items = res.Items ?? [];

  let profile: Profile = {};
  const moods: Mood[] = [];
  const open: Task[] = [];
  const done: Task[] = [];
  const gratitudes: Gratitude[] = [];

  for (const i of items) {
    const sk = i.SK as string;
    if (sk === "PROFILE") {
      profile = { preferredSpecies: i.preferredSpecies, locale: i.locale, emergencyContact: i.emergencyContact };
    } else if (sk.startsWith("MOOD#")) {
      moods.push({ mood: i.mood, note: i.note, createdAt: i.createdAt });
    } else if (sk.startsWith("TASK#")) {
      const t: Task = { id: i.id, text: i.text, status: i.status, createdAt: i.createdAt, completedAt: i.completedAt };
      (t.status === "completed" ? done : open).push(t);
    } else if (sk.startsWith("GRAT#")) {
      gratitudes.push({ text: i.text, createdAt: i.createdAt });
    }
  }

  moods.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  gratitudes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const day = today ?? new Date().toISOString().slice(0, 10);
  const moodDays = moods.map((m) => m.createdAt.slice(0, 10));
  const stats = { tasksDone: done.length, streakDays: computeStreak(moodDays, day) };

  return { profile, moods, tasks: { open, done }, gratitudes, stats };
}
