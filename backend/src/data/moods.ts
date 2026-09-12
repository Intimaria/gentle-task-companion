import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk, moodSk, MOOD_PREFIX } from "./table";

const doc = makeDocClient();

export interface Mood {
  mood: string;
  note?: string;
  createdAt: string;
}

export interface CreateMoodInput {
  mood: string;
  note?: string;
  /** Opcional: permite fijar el timestamp en tests. Por defecto, ahora. */
  createdAt?: string;
}

export async function createMood(sub: string, input: CreateMoodInput): Promise<Mood> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const item = {
    PK: userPk(sub),
    SK: moodSk(createdAt),
    type: "mood",
    mood: input.mood,
    note: input.note,
    createdAt,
  };
  await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { mood: input.mood, note: input.note, createdAt };
}

export async function deleteMood(sub: string, createdAt: string): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: userPk(sub), SK: moodSk(createdAt) } }));
}

export async function listMoods(
  sub: string,
  range?: { from?: string; to?: string },
): Promise<Mood[]> {
  const from = range?.from ? moodSk(range.from) : MOOD_PREFIX;
  const to = range?.to ? moodSk(range.to) + "￿" : MOOD_PREFIX + "￿";
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":pk": userPk(sub), ":from": from, ":to": to },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []).map((i) => ({
    mood: i.mood as string,
    note: i.note as string | undefined,
    createdAt: i.createdAt as string,
  }));
}
