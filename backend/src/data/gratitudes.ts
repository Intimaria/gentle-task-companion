import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const GRAT_PREFIX = "GRAT#";

export interface Gratitude {
  text: string;
  createdAt: string;
}

export async function createGratitude(
  sub: string, text: string, createdAt?: string,
): Promise<Gratitude> {
  const ts = createdAt ?? new Date().toISOString();
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: `${GRAT_PREFIX}${ts}`, type: "gratitude", text, createdAt: ts },
  }));
  return { text, createdAt: ts };
}

export async function deleteGratitude(sub: string, createdAt: string): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: userPk(sub), SK: `${GRAT_PREFIX}${createdAt}` } }));
}

export async function listGratitudes(sub: string): Promise<Gratitude[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": userPk(sub), ":p": GRAT_PREFIX },
    ScanIndexForward: false,
  }));
  return (res.Items ?? []).map((i) => ({ text: i.text as string, createdAt: i.createdAt as string }));
}
