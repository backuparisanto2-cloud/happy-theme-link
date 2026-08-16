// Starts the production build on any Node host (Windows 10 included).
// Nitro writes the Node entry to .output/server/index.mjs or dist/server/index.mjs
// depending on version/preset, so probe both.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const candidates = [
  ".output/server/index.mjs",
  "dist/server/index.mjs",
  ".output/server/index.js",
];

const entry = candidates.map((p) => resolve(process.cwd(), p)).find((p) => existsSync(p));

if (!entry) {
  console.error(
    "Build output not found. Run:\n  set NITRO_PRESET=node-server&& npm run build\nthen try again.",
  );
  process.exit(1);
}

process.env.PORT ??= "3000";
console.log(`Starting server from ${entry} on http://localhost:${process.env.PORT}`);
await import(pathToFileURL(entry).href);