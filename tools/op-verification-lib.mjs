import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants, createWriteStream } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(toolsDir, "..");
export const cacheDir = path.join(rootDir, ".op-cache");
export const logDir = path.join(cacheDir, "logs");
export const receiptDir = path.join(cacheDir, "receipts");

const SOURCE_EXCLUDES = new Set([
  "cloud-client.js",
  "confusion-globe.js",
  "data/vocabulary-index.json",
  "data/content-rights-summary.json",
  "data/content-rights-ledger.jsonl",
  "data/content-rights-ledger-summary.json",
  "data/public-attributions.json",
  "legal-sources.js",
  "SBOM.cdx.json",
  "THIRD_PARTY_LICENSES.md",
  "THIRD_PARTY_LICENSE_EVIDENCE.json",
  "sense-vocab-web.zip",
]);

const SOURCE_PREFIX_EXCLUDES = [
  ".git/",
  ".op-cache/",
  ".test-artifacts/",
  "dist/",
  "node_modules/",
  "playwright-report/",
  "test-results/",
  "docs/",
];

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeManifestContent(relativePath, content) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (normalizedPath === "package.json") {
    const parsed = JSON.parse(content);
    delete parsed.version;
    return Buffer.from(stableJson(parsed));
  }
  if (normalizedPath === "package-lock.json") {
    const parsed = JSON.parse(content);
    delete parsed.version;
    if (parsed.packages?.[""]) delete parsed.packages[""].version;
    return Buffer.from(stableJson(parsed));
  }
  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout ?? "";
}

export function gitText(args, options) {
  return git(args, options).trim();
}

function isRelevantSource(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (SOURCE_EXCLUDES.has(normalized)) return false;
  return !SOURCE_PREFIX_EXCLUDES.some((prefix) => normalized.startsWith(prefix));
}

export async function computeSourceManifest() {
  const listed = git(["ls-files", "-co", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((item) => item.replaceAll("\\", "/"))
    .filter(isRelevantSource)
    .sort();
  const files = [];
  for (const relativePath of listed) {
    const absolutePath = path.join(rootDir, relativePath);
    try {
      const content = await readFile(absolutePath);
      files.push({
        path: relativePath,
        sha256: sha256(normalizeManifestContent(relativePath, content)),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
  return {
    hash: sha256(stableJson({ files, environment })),
    files,
    environment,
  };
}

async function walkFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walkFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      output.push({
        path: relativePath,
        sha256: sha256(await readFile(absolutePath)),
      });
    }
  }
  return output;
}

export async function computeDistManifest() {
  const distDir = path.join(rootDir, "dist");
  try {
    await access(distDir, fsConstants.R_OK);
  } catch {
    return null;
  }
  const files = await walkFiles(distDir);
  return {
    hash: sha256(stableJson(files)),
    files,
  };
}

export async function ensureCache() {
  await mkdir(logDir, { recursive: true });
  await mkdir(receiptDir, { recursive: true });
}

export async function cleanupCache({ maxAgeDays = 7 } = {}) {
  await ensureCache();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const directory of [logDir, receiptDir]) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const absolutePath = path.join(directory, entry.name);
      if ((await stat(absolutePath)).mtimeMs < cutoff) {
        await rm(absolutePath, { force: true });
      }
    }
  }
}

export function timestampToken() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export async function runCaptured(command, args, {
  gate = "command",
  env = {},
  maxTailBytes = 96 * 1024,
} = {}) {
  await ensureCache();
  const logPath = path.join(logDir, `${timestampToken()}-${gate}.log`);
  const stream = createWriteStream(logPath, { encoding: "utf8" });
  const startedAt = Date.now();
  const tailChunks = [];
  let tailBytes = 0;
  const child = spawn(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    shell: false,
    windowsHide: true,
  });
  const capture = (chunk) => {
    stream.write(chunk);
    const buffer = Buffer.from(chunk);
    tailChunks.push(buffer);
    tailBytes += buffer.length;
    while (tailBytes > maxTailBytes && tailChunks.length > 1) {
      tailBytes -= tailChunks.shift().length;
    }
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  await new Promise((resolve) => stream.end(resolve));
  return {
    exitCode: Number(exitCode ?? 1),
    durationMs: Date.now() - startedAt,
    logPath,
    tail: Buffer.concat(tailChunks).toString("utf8").slice(-maxTailBytes),
    command: [command, ...args],
  };
}

export function compactLogPath(absolutePath) {
  return path.relative(rootDir, absolutePath).replaceAll("\\", "/");
}

export function failureSummary(result, extra = {}) {
  const lines = result.tail.split(/\r?\n/).filter(Boolean).slice(-60);
  let evidence = lines.join("\n");
  if (evidence.length > 8000) evidence = evidence.slice(-8000);
  return {
    status: "failed",
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    log: compactLogPath(result.logPath),
    ...extra,
    evidence,
  };
}

export async function writeReceipt(gate, inputHash, receipt) {
  await ensureCache();
  const safeGate = gate.replace(/[^a-z0-9_-]+/gi, "-");
  const target = path.join(receiptDir, `${safeGate}-${inputHash}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return target;
}

export async function readReceipt(gate, inputHash) {
  const target = path.join(
    receiptDir,
    `${gate.replace(/[^a-z0-9_-]+/gi, "-")}-${inputHash}.json`,
  );
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function listReceipts(gate) {
  await ensureCache();
  const prefix = `${gate.replace(/[^a-z0-9_-]+/gi, "-")}-`;
  const receipts = [];
  for (const entry of await readdir(receiptDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      receipts.push(JSON.parse(await readFile(path.join(receiptDir, entry.name), "utf8")));
    } catch {
      // A corrupt local cache is never accepted as verification evidence.
    }
  }
  return receipts.sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
}

export function gitEvidence() {
  const diff = git(["diff", "--binary", "HEAD"], { allowFailure: true });
  return {
    head: gitText(["rev-parse", "HEAD"]),
    status: git(["status", "--short"]).trim().split(/\r?\n/).filter(Boolean),
    diffSha256: sha256(diff),
  };
}

export function classifyRisk(paths, { release = false } = {}) {
  if (release) return "T4";
  const normalized = paths.map((item) => item.replaceAll("\\", "/"));
  if (!normalized.length) return "T0";
  if (normalized.every((item) => (
    item.endsWith(".md") ||
    item.endsWith(".txt") ||
    item.startsWith("docs/")
  ))) return "T0";
  if (normalized.some((item) => (
    item === "data/vocabulary-bundle.json" ||
    item.startsWith("data/content-change-sets/") ||
    /(^|\/)audio/i.test(item)
  ))) return "T2";
  if (normalized.some((item) => (
    item.startsWith("supabase/") ||
    item === "package.json" ||
    item === "package-lock.json" ||
    item === "playwright.config.js" ||
    /\.(?:js|mjs|cjs|py|ps1|html|css)$/.test(item)
  ))) return "T3";
  if (normalized.some((item) => item.startsWith("data/"))) return "T1";
  return "T3";
}

export function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
