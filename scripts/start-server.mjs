// Starts the production build on any Node host (Windows 10 included).
// Nitro writes the Node entry to .output/server/index.mjs or dist/server/index.mjs
// depending on version/preset, so probe both.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Load .env manually (no dependency) so SUPABASE_*, SERVICE_ACCOUNT_* and
// WHATSAPP_WORKER_SECRET reach the production server process.
const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

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