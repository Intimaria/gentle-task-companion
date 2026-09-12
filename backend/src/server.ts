import { serve } from "@hono/node-server";
import { createAppFromEnv } from "./appFactory";

const app = createAppFromEnv();
const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port });
console.log(`gentle-backend escuchando en :${port}`);
