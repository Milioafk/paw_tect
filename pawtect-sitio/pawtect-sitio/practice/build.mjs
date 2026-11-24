import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ["practice/worker.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  tsconfigRaw: { compilerOptions: { alwaysStrict: true } },
  loader: { ".sql": "text" },
  outfile: "public/practica-assets/practica.js",
});
await import("../portable/render.mjs");
