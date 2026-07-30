import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const indexPath = path.join(rootDir, "data", "vocabulary-index.json");

const bundleBytes = await readFile(bundlePath);
const bundle = JSON.parse(bundleBytes.toString("utf8"));

if (!Array.isArray(bundle?.words) || !Array.isArray(bundle?.books)) {
  throw new Error("Vocabulary bundle has an invalid schema.");
}

const index = {
  schemaVersion: bundle.schemaVersion,
  defaultBookId: bundle.defaultBookId,
  bundleVersion: createHash("sha256").update(bundleBytes).digest("hex"),
  books: bundle.books,
  words: bundle.words.map((word) => ({
    id: word.id,
    word: word.word,
    senses: word.senses.map((sense, indexPosition) => ({
      id: sense.id,
      importance: Number.isFinite(sense.importance)
        ? sense.importance
        : Math.max(1, 100 - indexPosition * 3),
    })),
  })),
};

await writeFile(indexPath, JSON.stringify(index), "utf8");

console.log(
  `Vocabulary index created with ${index.words.length} words at ${indexPath}`,
);
