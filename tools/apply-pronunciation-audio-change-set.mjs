import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const cachePath = path.join(rootDir, "data", "wikimedia-audio-rights-cache.json");
const manifestPath = path.join(
  rootDir,
  "data",
  "content-change-sets",
  "rd-multi-pronunciation-2026-08-12.json",
);
const recoverHeadBaseline = process.argv.includes("--recover-head-baseline");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function valueSha256(value) {
  return sha256(JSON.stringify(value ?? null));
}

function gitFile(relativePath) {
  return execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: rootDir,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function originalFilename(audioUrl) {
  const url = new URL(audioUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const transcodedIndex = segments.indexOf("transcoded");
  return decodeURIComponent(
    transcodedIndex >= 0 ? segments.at(-2) : segments.at(-1),
  );
}

function cacheKey(filename) {
  return String(filename ?? "")
    .replace(/^File:/i, "")
    .replaceAll("_", " ")
    .normalize("NFC")
    .toLocaleLowerCase("en-US");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const currentBytes = await readFile(bundlePath);
let baselineBytes = currentBytes;
if (sha256(currentBytes) !== manifest.baseline.sha256) {
  if (!recoverHeadBaseline) {
    const current = JSON.parse(currentBytes.toString("utf8"));
    const currentWords = new Map(current.words.map((word) => [word.id, word]));
    const alreadyApplied = manifest.items.every((item) => {
      const sense = currentWords.get(item.wordId)?.senses
        ?.find((candidate) => candidate.id === item.senseId);
      return sense && Object.entries(item.fields).every(
        ([field, value]) => JSON.stringify(sense[field]) === JSON.stringify(value),
      );
    });
    if (alreadyApplied) {
      console.log("Pronunciation audio change set is already applied.");
      process.exit(0);
    }
    throw new Error(
      "Bundle does not match the pinned baseline. Use --recover-head-baseline only after confirming the formal bundle had no pre-existing worktree changes.",
    );
  }
  baselineBytes = gitFile("data/vocabulary-bundle.json");
}

if (sha256(baselineBytes) !== manifest.baseline.sha256) {
  throw new Error("Pinned baseline hash does not match the recovered bundle.");
}

const bundle = JSON.parse(baselineBytes.toString("utf8"));
const words = new Map(bundle.words.map((word) => [word.id, word]));
const wordIdsBefore = bundle.words.map((word) => word.id);
const senseIdsBefore = bundle.words.flatMap((word) => (
  word.senses.map((sense) => `${word.id}:${sense.id}`)
));

for (const item of manifest.items) {
  const sense = words.get(item.wordId)?.senses
    ?.find((candidate) => candidate.id === item.senseId);
  if (!sense) throw new Error(`Unknown stable sense: ${item.wordId}:${item.senseId}.`);
  for (const [field, audit] of Object.entries(item.fieldAudit ?? {})) {
    if (valueSha256(sense[field]) !== audit.oldValueSha256) {
      throw new Error(`Baseline value drifted for ${item.wordId}:${item.senseId}:${field}.`);
    }
    if (valueSha256(item.fields[field]) !== audit.newValueSha256) {
      throw new Error(`Reviewed value hash failed for ${item.wordId}:${item.senseId}:${field}.`);
    }
  }
  Object.assign(sense, item.fields);
}

const wordIdsAfter = bundle.words.map((word) => word.id);
const senseIdsAfter = bundle.words.flatMap((word) => (
  word.senses.map((sense) => `${word.id}:${sense.id}`)
));
if (JSON.stringify(wordIdsBefore) !== JSON.stringify(wordIdsAfter)
  || JSON.stringify(senseIdsBefore) !== JSON.stringify(senseIdsAfter)) {
  throw new Error("Pronunciation update changed stable word or sense identities.");
}

await writeFile(bundlePath, JSON.stringify(bundle), "utf8");

if (recoverHeadBaseline) {
  const currentCache = JSON.parse(await readFile(cachePath, "utf8"));
  const targetKeys = new Set(
    manifest.items
      .map((item) => item.fields.audio)
      .filter(Boolean)
      .map((audio) => cacheKey(originalFilename(audio))),
  );
  let baseCache;
  try {
    baseCache = JSON.parse(
      gitFile("data/wikimedia-audio-rights-cache.json").toString("utf8"),
    );
  } catch {
    // The cache is intentionally ignored in older checkouts. Remove only the
    // non-target entries added by this turn's broad recovery attempt; retain
    // every pre-existing entry and every file used by this reviewed batch.
    baseCache = structuredClone(currentCache);
    const broadRecoveryStartedAt = "2026-08-12T15:03:00.000Z";
    for (const [key, evidence] of Object.entries(baseCache.files ?? {})) {
      if (!targetKeys.has(key) && evidence.fetchedAt >= broadRecoveryStartedAt) {
        delete baseCache.files[key];
      }
    }
  }
  for (const key of targetKeys) {
    const evidence = currentCache.files?.[key];
    if (!evidence) throw new Error(`Missing cached rights evidence for ${key}.`);
    baseCache.files[key] = evidence;
  }
  const fetchedAt = [...targetKeys]
    .map((key) => baseCache.files[key]?.fetchedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (fetchedAt) baseCache.updatedAt = fetchedAt;
  await writeFile(cachePath, `${JSON.stringify(baseCache, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  batchId: manifest.batchId,
  words: wordIdsAfter.length,
  senses: senseIdsAfter.length,
  appliedItems: manifest.items.length,
  bundleSha256: sha256(await readFile(bundlePath)),
}, null, 2));
