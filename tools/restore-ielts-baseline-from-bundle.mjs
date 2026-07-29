import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");

const bundle = JSON.parse(
  await readFile(path.join(dataDir, "vocabulary-bundle.json"), "utf8"),
);
const words = bundle.words
  .filter((word) => word.senses.some((sense) => (
    String(sense.bookSource ?? "").startsWith("ielts-")
  )))
  .map((word) => ({
    id: word.id,
    word: word.word,
    morphology: word.morphology ?? null,
    senses: word.senses.map((sense) => {
      const restored = { ...sense };
      delete restored.bookSource;
      return restored;
    }),
  }));

if (words.length !== 1565) {
  throw new Error(`Expected 1565 IELTS baseline words, received ${words.length}.`);
}
await writeFile(
  path.join(dataDir, "ielts-new-words.json"),
  `${JSON.stringify(words, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  words: words.length,
  senses: words.reduce((total, word) => total + word.senses.length, 0),
}, null, 2));
