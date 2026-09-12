import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { TABLE_NAME } from "../src/data/client";

export async function createTable(): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
  });

  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof ResourceInUseException)) throw err;
  }
  await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createTable().then(() => console.log(`Tabla ${TABLE_NAME} lista`));
}
