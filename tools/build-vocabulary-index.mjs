import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const indexPath = path.join(rootDir, "data", "vocabulary-index.json");
const wordnetDbDir = path.join(rootDir, "node_modules", "wordnet", "db");

const WORDNET_RELATION_SYMBOLS = new Set(["&", "^", "+"]);

function wordnetSynsetId(offset, pos) {
  return `omw-en-${String(offset).padStart(8, "0")}-${pos}`;
}

async function buildSemanticRelations(synsetIds) {
  const relations = new Map();
  const addRelation = (left, right) => {
    if (!synsetIds.has(left) || !synsetIds.has(right) || left === right) return;
    const targets = relations.get(left) ?? new Set();
    targets.add(right);
    relations.set(left, targets);
  };

  for (const pos of ["adj", "adv", "noun", "verb"]) {
    const filePath = path.join(wordnetDbDir, `data.${pos}`);
    const contents = await readFile(filePath, "utf8");
    const normalizedPos = pos === "adj" ? ["a", "s"] : [
      pos === "noun" ? "n" : pos === "verb" ? "v" : "r",
    ];
    contents.split(/\r?\n/).forEach((line) => {
      if (!line || line.startsWith(" ")) return;
      const metadata = line.split("|")[0].trim().split(/\s+/);
      if (metadata.length < 5) return;
      const currentOffset = metadata[0];
      const currentPos = metadata[2];
      if (!normalizedPos.includes(currentPos)) return;
      const currentId = wordnetSynsetId(currentOffset, currentPos);
      let cursor = 4;
      const wordCount = Number.parseInt(metadata[3], 16);
      cursor += wordCount * 2;
      const pointerCount = Number.parseInt(metadata[cursor] ?? "0", 10);
      cursor += 1;
      for (let index = 0; index < pointerCount; index += 1) {
        const symbol = metadata[cursor];
        const targetOffset = metadata[cursor + 1];
        const targetPos = metadata[cursor + 2];
        cursor += 4;
        if (!WORDNET_RELATION_SYMBOLS.has(symbol) || !targetOffset || !targetPos) {
          continue;
        }
        const targetId = wordnetSynsetId(targetOffset, targetPos);
        addRelation(currentId, targetId);
        addRelation(targetId, currentId);
      }
    });
  }

  return Object.fromEntries(
    [...relations.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([synsetId, targets]) => [synsetId, [...targets].sort()]),
  );
}

async function writeFileWithRetry(filePath, contents) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await writeFile(filePath, contents, "utf8");
      return;
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "EPERM", "UNKNOWN"].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  throw lastError;
}

const bundleBytes = await readFile(bundlePath);
const bundle = JSON.parse(bundleBytes.toString("utf8"));

if (!Array.isArray(bundle?.words) || !Array.isArray(bundle?.books)) {
  throw new Error("Vocabulary bundle has an invalid schema.");
}

const bundleSynsetIds = new Set(
  bundle.words.flatMap((word) => word.senses)
    .map((sense) => sense.synsetId)
    .filter(Boolean),
);
const semanticRelations = await buildSemanticRelations(bundleSynsetIds);

const index = {
  schemaVersion: bundle.schemaVersion,
  defaultBookId: bundle.defaultBookId,
  bundleVersion: createHash("sha256").update(bundleBytes).digest("hex"),
  books: bundle.books,
  search: {
    schemaVersion: 1,
    semanticRelations,
  },
  words: bundle.words.map((word) => ({
    id: word.id,
    word: word.word,
    senses: word.senses.map((sense, indexPosition) => ({
      id: sense.id,
      meaning: sense.meaning,
      synsetId: sense.synsetId ?? null,
      importance: Number.isFinite(sense.importance)
        ? sense.importance
        : Math.max(1, 100 - indexPosition * 3),
    })),
  })),
};

await writeFileWithRetry(indexPath, JSON.stringify(index));

console.log(
  `Vocabulary index created with ${index.words.length} words at ${indexPath}`,
);
