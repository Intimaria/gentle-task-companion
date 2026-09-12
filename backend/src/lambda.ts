import { handle } from "hono/aws-lambda";
import { createAppFromEnv } from "./appFactory";

// El MISMO app de Hono, envuelto con el adapter de AWS Lambda (API Gateway v2).
export const handler = handle(createAppFromEnv());
