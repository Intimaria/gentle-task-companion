import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Crea un DocumentClient apuntando al endpoint configurado.
 * Portable: DYNAMODB_ENDPOINT = DynamoDB Local | ScyllaDB Alternator | (vacío) AWS real.
 */
export function makeDocClient(): DynamoDBDocumentClient {
  const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
  const base = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export const TABLE_NAME = process.env.TABLE_NAME || "gentle";
