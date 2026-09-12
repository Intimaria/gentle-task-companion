import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    env: {
      DYNAMODB_ENDPOINT: "http://localhost:8001",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "local",
      AWS_SECRET_ACCESS_KEY: "local",
      TABLE_NAME: "gentle",
    },
    hookTimeout: 30000,
  },
});
