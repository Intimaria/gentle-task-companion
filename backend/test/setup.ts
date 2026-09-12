import { createTable } from "../scripts/create-table";

export default async function setup(): Promise<void> {
  // vitest `env` only applies to test workers, not to globalSetup.
  // Set the vars here so create-table uses DynamoDB Local.
  process.env.DYNAMODB_ENDPOINT ??= "http://localhost:8001";
  process.env.AWS_REGION ??= "us-east-1";
  process.env.AWS_ACCESS_KEY_ID ??= "local";
  process.env.AWS_SECRET_ACCESS_KEY ??= "local";
  process.env.TABLE_NAME ??= "gentle";
  await createTable();
}
