import "hono";

declare module "hono" {
  interface ContextVariableMap {
    sub: string;
    groups: string[];
  }
}
