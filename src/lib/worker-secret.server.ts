import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const SECRET_KEY = "WHATSAPP_WORKER_SECRET";

export type EnvTarget = { id: "app" | "worker"; label: string; path: string };

export const ENV_TARGETS: Array<EnvTarget> = [
  { id: "app", label: "Aplikasi", path: ".env" },
  { id: "worker", label: "Worker WhatsApp", path: "worker/.env" },
];

export type FileStatus = {
  id: EnvTarget["id"];
  label: string;
  path: string;
  exists: boolean;
  hasSecret: boolean;
  length: number;
  fingerprint: string | null;
};

export type SecretStatus = {
  /** false on serverless hosting where the filesystem is not persistent. */
  writable: boolean;
  runtimeSet: boolean;
  runtimeFingerprint: string | null;
  files: Array<FileStatus>;
  match: boolean;
  problems: Array<string>;
};

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(line.slice(0, eq).trim(), value);
  }
  return map;
}

/** Rewrites (or appends) a single key while keeping every other line intact. */
function upsertKey(content: string, key: string, value: string): string {
  const lines = content.length ? content.split(/\r?\n/) : [];
  let replaced = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq < 1 || trimmed.slice(0, eq).trim() !== key) return line;
    replaced = true;
    return `${key}=${value}`;
  });
  if (!replaced) {
    if (next.length && next[next.length - 1]!.trim() !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  if (next[next.length - 1] !== "") next.push("");
  return next.join("\n");
}

function isFilesystemWritable(): boolean {
  // Serverless/worker hosting has no persistent project directory.
  try {
    return existsSync(resolve(process.cwd(), "package.json"));
  } catch {
    return false;
  }
}

async function readTarget(target: EnvTarget): Promise<FileStatus> {
  const path = resolve(process.cwd(), target.path);
  if (!existsSync(path)) {
    return {
      id: target.id,
      label: target.label,
      path: target.path,
      exists: false,
      hasSecret: false,
      length: 0,
      fingerprint: null,
    };
  }
  const value = parseEnv(await readFile(path, "utf8")).get(SECRET_KEY) ?? "";
  return {
    id: target.id,
    label: target.label,
    path: target.path,
    exists: true,
    hasSecret: value.length > 0,
    length: value.length,
    fingerprint: value.length > 0 ? fingerprint(value) : null,
  };
}

export async function readSecretStatus(): Promise<SecretStatus> {
  const writable = isFilesystemWritable();
  const runtime = process.env[SECRET_KEY] ?? "";
  const files = writable ? await Promise.all(ENV_TARGETS.map(readTarget)) : [];

  const problems: Array<string> = [];
  for (const file of files) {
    if (!file.exists) problems.push(`File ${file.path} belum ada.`);
    else if (!file.hasSecret) problems.push(`${SECRET_KEY} belum diisi di ${file.path}.`);
    else if (file.length < 32) problems.push(`Nilai di ${file.path} terlalu pendek (min. 32 karakter).`);
  }

  const prints = files.filter((f) => f.fingerprint).map((f) => f.fingerprint);
  const match =
    files.length > 0 && prints.length === files.length && new Set(prints).size === 1;
  if (prints.length === files.length && files.length > 0 && !match) {
    problems.push("Nilai di .env aplikasi dan worker/.env berbeda (mismatch).");
  }
  if (writable && match && runtime && fingerprint(runtime) !== prints[0]) {
    problems.push("Server masih memakai nilai lama — restart aplikasi agar .env terbaru terbaca.");
  }

  return {
    writable,
    runtimeSet: runtime.length > 0,
    runtimeFingerprint: runtime.length > 0 ? fingerprint(runtime) : null,
    files,
    match,
    problems,
  };
}

export type WriteResult = {
  ok: boolean;
  secret?: string;
  written: Array<string>;
  error?: string;
  status: SecretStatus;
};

/**
 * Writes the same secret to every env file so the app and the worker can never
 * drift apart. `secret` omitted = generate a fresh 64-char hex value.
 */
export async function writeSecretEverywhere(secret?: string): Promise<WriteResult> {
  if (!isFilesystemWritable()) {
    return {
      ok: false,
      written: [],
      error:
        "Penulisan .env hanya bisa dilakukan saat aplikasi berjalan di komputer Anda (self-host). Di hosting ini, simpan secret lewat pengaturan secret proyek.",
      status: await readSecretStatus(),
    };
  }

  const value = (secret ?? randomBytes(32).toString("hex")).trim();
  if (value.length < 32 || /\s/.test(value)) {
    return {
      ok: false,
      written: [],
      error: "Secret harus minimal 32 karakter dan tanpa spasi.",
      status: await readSecretStatus(),
    };
  }

  const written: Array<string> = [];
  try {
    for (const target of ENV_TARGETS) {
      const path = resolve(process.cwd(), target.path);
      const examplePath = resolve(process.cwd(), `${target.path}.example`);
      let current = "";
      if (existsSync(path)) current = await readFile(path, "utf8");
      else if (existsSync(examplePath)) current = await readFile(examplePath, "utf8");
      await writeFile(path, upsertKey(current, SECRET_KEY, value), "utf8");
      written.push(target.path);
    }
  } catch (err) {
    return {
      ok: false,
      written,
      error: `Gagal menulis file: ${err instanceof Error ? err.message : String(err)}`,
      status: await readSecretStatus(),
    };
  }

  return { ok: true, secret: value, written, status: await readSecretStatus() };
}