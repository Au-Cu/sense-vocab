import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  classifyRisk,
  emit,
  gitText,
  rootDir,
} from "./op-verification-lib.mjs";

function git(args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || "git failed");
  return result.stdout ?? "";
}

function parseStatus() {
  const tokens = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    .split("\0")
    .filter(Boolean);
  const changed = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const entry = { status, path: token.slice(3).replaceAll("\\", "/") };
    if (/[RC]/.test(status) && tokens[index + 1]) {
      entry.from = tokens[index + 1].replaceAll("\\", "/");
      index += 1;
    }
    changed.push(entry);
  }
  return changed;
}

async function hashIfDocument(relativePath) {
  if (!relativePath.endsWith(".md") && !relativePath.endsWith(".txt")) return null;
  try {
    return createHash("sha256")
      .update(await readFile(path.join(rootDir, relativePath)))
      .digest("hex");
  } catch {
    return null;
  }
}

const changed = parseStatus();
const docsChanged = [];
for (const entry of changed) {
  const hash = await hashIfDocument(entry.path);
  if (hash) docsChanged.push({ path: entry.path, sha256: hash });
}
const counts = {};
for (const entry of changed) {
  const key = entry.status.trim() || entry.status;
  counts[key] = (counts[key] ?? 0) + 1;
}

emit({
  cwd: rootDir,
  branch: gitText(["branch", "--show-current"]),
  head: gitText(["rev-parse", "HEAD"]),
  tag: gitText(["describe", "--tags", "--abbrev=0"], { allowFailure: true }) || null,
  clean: changed.length === 0,
  risk: classifyRisk(changed.map((entry) => entry.path), {
    release: process.argv.includes("--release"),
  }),
  summary: { changed: changed.length, byStatus: counts },
  changed,
  docsChanged,
});
