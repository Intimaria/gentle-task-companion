import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
export const BUCKET = process.env.S3_BUCKET || "gentle-media";

function pickEndpoint(v: string | undefined): string | undefined {
  return v ? v : undefined;
}

// Emulado (endpoint presente) = path-style + credenciales explícitas (MiniStack/MinIO).
// AWS real (sin endpoint) = virtual-hosted + cadena default (rol IAM de la Lambda).
function makeS3(endpoint: string | undefined): S3Client {
  const emulated = Boolean(endpoint);
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    ...(emulated
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
            secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
          },
        }
      : {}),
  });
}
// interno = subir/leer; público = prefirmar (host que ve el navegador)
export const s3 = makeS3(pickEndpoint(process.env.S3_ENDPOINT));
export const s3Public = makeS3(pickEndpoint(process.env.S3_PUBLIC_ENDPOINT) || pickEndpoint(process.env.S3_ENDPOINT));

export interface SavedAnimal {
  id: string;
  species: string;
  savedAt: string;
  url: string;
}

export async function saveAnimal(sub: string, species: string, sourceUrl: string): Promise<{ id: string }> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`fetch image responded ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const body = new Uint8Array(await res.arrayBuffer());
  const id = ulid();
  const s3Key = `users/${sub}/${id}`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, Body: body, ContentType: contentType }));
  const savedAt = new Date().toISOString();
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: `ANIMAL#${id}`, type: "animal", id, species, s3Key, contentType, savedAt },
  }));
  return { id };
}

export async function listSaved(sub: string): Promise<SavedAnimal[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": userPk(sub), ":p": "ANIMAL#" },
    ScanIndexForward: false,
  }));
  const items = res.Items ?? [];
  const results = await Promise.allSettled(items.map(async (i) => ({
    id: i.id as string,
    species: i.species as string,
    savedAt: i.savedAt as string,
    url: await getSignedUrl(s3Public, new GetObjectCommand({ Bucket: BUCKET, Key: i.s3Key as string }), { expiresIn: 900 }),
  })));
  return results
    .filter((r): r is PromiseFulfilledResult<SavedAnimal> => r.status === "fulfilled")
    .map((r) => r.value);
}
