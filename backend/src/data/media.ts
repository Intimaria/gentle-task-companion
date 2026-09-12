import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { makeDocClient, TABLE_NAME } from "./client";
import { s3Public, s3, BUCKET } from "./storage";

const doc = makeDocClient();

export type MediaKind = "sound" | "meditation";

export function isMediaKind(s: string): s is MediaKind {
  return s === "sound" || s === "meditation";
}

export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
}

export async function createUploadUrl(
  kind: MediaKind,
  contentType: string,
): Promise<{ id: string; s3Key: string; putUrl: string }> {
  const id = ulid();
  const s3Key = `media/${kind}/${id}`;
  const putUrl = await getSignedUrl(
    s3Public,
    new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: contentType }),
    { expiresIn: 900 },
  );
  return { id, s3Key, putUrl };
}

export async function confirmMedia(item: {
  id: string;
  name: string;
  kind: MediaKind;
  s3Key: string;
  contentType: string;
}): Promise<void> {
  const { id, name, kind, s3Key, contentType } = item;
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: "MEDIA",
      SK: `${kind}#${id}`,
      type: "media",
      id,
      name,
      kind,
      s3Key,
      contentType,
      createdAt: new Date().toISOString(),
    },
  }));
}

export async function listMedia(kind?: MediaKind): Promise<MediaItem[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: kind
      ? "PK = :pk AND begins_with(SK, :p)"
      : "PK = :pk",
    ExpressionAttributeValues: kind
      ? { ":pk": "MEDIA", ":p": `${kind}#` }
      : { ":pk": "MEDIA" },
  }));
  const items = res.Items ?? [];
  const results = await Promise.allSettled(
    items.map(async (i) => ({
      id: i.id as string,
      name: i.name as string,
      kind: i.kind as MediaKind,
      url: await getSignedUrl(
        s3Public,
        new GetObjectCommand({ Bucket: BUCKET, Key: i.s3Key as string }),
        { expiresIn: 900 },
      ),
    })),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<MediaItem> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function deleteMedia(kind: MediaKind, id: string): Promise<void> {
  await doc.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: "MEDIA", SK: `${kind}#${id}` },
  }));
  const s3Key = `media/${kind}/${id}`;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  } catch {
    // best-effort: ignore S3 delete errors
  }
}
