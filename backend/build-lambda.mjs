import { build } from "esbuild";

// Bundle TODO (incluido aws-sdk) en un solo cjs: el runtime de la Lambda emulada
// no garantiza tener las deps. Handler = index.handler.
await build({
  entryPoints: ["src/lambda.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  // .js (no .cjs): el runtime nodejs de Lambda resuelve `index.handler` sobre index.js,
  // y como el zip no lleva package.json, trata el archivo como CommonJS.
  outfile: "dist/lambda/index.js",
  banner: { js: "// gentle-backend lambda bundle" },
});
console.log("lambda bundle → dist/lambda/index.js");
