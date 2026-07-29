import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const lockPath = path.join(rootDir, "data", "content-identity-lock.json");
const writeMode = process.argv.includes("--write");

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildIdentity(bundle) {
  const books = bundle.books.map((book) => {
    const entries = book.entries.map((entry) => [
      entry.wordId,
      [...entry.senseIds],
    ]);
    return {
      id: book.id,
      name: book.name,
      entryCount: entries.length,
      senseReferenceCount: entries.reduce(
        (total, [, senseIds]) => total + senseIds.length,
        0,
      ),
      identitySha256: sha256(entries),
    };
  });
  const wordPool = bundle.words.map((word) => [
    word.id,
    word.word,
    word.senses.map((sense) => sense.id),
  ]);

  return {
    formatVersion: 1,
    schemaVersion: bundle.schemaVersion,
    defaultBookId: bundle.defaultBookId,
    books,
    wordPool: {
      wordCount: wordPool.length,
      senseCount: wordPool.reduce(
        (total, [, , senseIds]) => total + senseIds.length,
        0,
      ),
      identitySha256: sha256(wordPool),
    },
  };
}

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const current = buildIdentity(bundle);

if (writeMode) {
  await writeFile(lockPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Content identity lock written to ${lockPath}`);
  process.exit(0);
}

let expected;
try {
  expected = JSON.parse(await readFile(lockPath, "utf8"));
} catch (error) {
  throw new Error(
    `Content identity lock is missing or invalid. Run "npm run lock:content-identity" once after reviewing the current vocabulary bundle.\n${error.message}`,
  );
}

if (JSON.stringify(current) !== JSON.stringify(expected)) {
  console.error("Vocabulary identity changed. Publication has been blocked.");
  console.error("Expected:");
  console.error(JSON.stringify(expected, null, 2));
  console.error("Current:");
  console.error(JSON.stringify(current, null, 2));
  console.error(
    "Do not update the lock until book membership, word order, word IDs and sense IDs have been reviewed for progress compatibility.",
  );
  process.exit(1);
}

console.log(
  `Content identity verified: ${current.wordPool.wordCount} words, ${current.wordPool.senseCount} senses, ${current.books.length} books.`,
);
