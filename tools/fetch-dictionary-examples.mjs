import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDS_PATH = path.join(ROOT, "data", "kaoyan-words.json");
const CACHE_PATH = path.join(ROOT, "data", "dictionary-example-cache.json");
const BUILD_REPORT_PATH = path.join(ROOT, "data", "context-example-build-report.json");
const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactEntries(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) => ({
      meanings: (entry.meanings || [])
        .map((meaning) => ({
          partOfSpeech: meaning.partOfSpeech || "",
          definitions: (meaning.definitions || [])
            .map((definition) => ({
              definition: String(definition.definition || "").trim(),
              example: String(definition.example || "").trim(),
            }))
            .filter((definition) => definition.definition),
        }))
        .filter((meaning) => meaning.definitions.length),
    }))
    .filter((entry) => entry.meanings.length);
}

async function fetchWord(word, timeoutMs, retries) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}${encodeURIComponent(word)}`, {
        headers: { connection: "close" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 404) return [word, []];
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return [word, compactEntries(await response.json())];
    } catch (error) {
      if (attempt === retries) return [word, null];
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return [word, null];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const rawValue = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  return {
    workers: Math.max(1, Number(rawValue("--workers", 8))),
    timeoutMs: Math.max(1000, Number(rawValue("--timeout", 15000))),
    retries: Math.max(0, Number(rawValue("--retries", 2))),
    limit: Math.max(0, Number(rawValue("--limit", 0))),
    missingOnly: args.includes("--missing-only"),
    wordsPath: path.resolve(ROOT, rawValue("--words-path", path.relative(ROOT, WORDS_PATH))),
    cachePath: path.resolve(ROOT, rawValue("--cache-path", path.relative(ROOT, CACHE_PATH))),
    reportPath: path.resolve(
      ROOT,
      rawValue("--report-path", path.relative(ROOT, BUILD_REPORT_PATH)),
    ),
  };
}

async function main() {
  const options = parseArgs();
  const words = readJson(options.wordsPath, []);
  const cache = readJson(options.cachePath, {});
  const requestedWords = options.missingOnly
    ? [
        ...new Set(
          (readJson(options.reportPath, {}).missing || []).map((entry) => entry.word),
        ),
      ]
    : words.map((entry) => entry.word);
  let pending = requestedWords
    .filter((word) => word && !(word in cache));
  if (options.limit) pending = pending.slice(0, options.limit);

  console.log(`dictionary cache: ${Object.keys(cache).length} present, ${pending.length} pending`);
  let cursor = 0;
  let completed = 0;
  const failures = [];

  async function worker() {
    while (cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const [word, entries] = await fetchWord(
        pending[index],
        options.timeoutMs,
        options.retries,
      );
      if (entries === null) failures.push(word);
      else cache[word] = entries;
      completed += 1;
      if (completed % 100 === 0) {
        writeJson(options.cachePath, cache);
        console.log(`dictionary cache: ${completed}/${pending.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: options.workers }, () => worker()));
  writeJson(options.cachePath, cache);
  const examples = Object.values(cache).reduce(
    (total, entries) =>
      total +
      entries.reduce(
        (entryTotal, entry) =>
          entryTotal +
          entry.meanings.reduce(
            (meaningTotal, meaning) =>
              meaningTotal + meaning.definitions.filter((definition) => definition.example).length,
            0,
          ),
        0,
      ),
    0,
  );
  console.log(
    `dictionary cache complete: ${Object.keys(cache).length} words, ${examples} examples, ` +
      `${failures.length} transient failures`,
  );
  if (failures.length) console.log(`retry words: ${failures.slice(0, 40).join(", ")}`);
}

await main();
