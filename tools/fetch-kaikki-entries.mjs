import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const inputPath = path.join(rootDir, "data", "ielts-new-words.json");
const cachePath = path.join(rootDir, "data", "ielts-kaikki-cache.json");
const reportPath = path.join(rootDir, "data", "ielts-kaikki-report.json");
const concurrency = Math.max(1, Math.min(8, Number(process.argv[2]) || 6));
const CACHE_VERSION = 3;

const POS_MAP = {
  noun: "n.",
  verb: "v.",
  adj: "adj.",
  adv: "adv.",
  prep: "prep.",
  preposition: "prep.",
  conj: "conj.",
  conjunction: "conj.",
  pron: "pron.",
  pronoun: "pron.",
  num: "num.",
  numeral: "num.",
  intj: "int.",
  interjection: "int.",
  phrase: "phrase.",
};

async function writeJsonAtomic(targetPath, value, pretty = false) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`,
    "utf8",
  );
  await rename(temporaryPath, targetPath);
}

function compactEntry(entry) {
  if (entry?.lang_code !== "en" || !entry.word || entry.pos === "name") return null;
  const senses = (entry.senses ?? []).map((sense) => {
    const examples = (sense.examples ?? [])
      .filter((example) => example?.text && example.type === "example")
      .map((example) => example.text.trim())
      .filter(Boolean);
    const quotations = (sense.examples ?? [])
      .filter((example) => example?.text && example.type === "quotation")
      .map((example) => example.text.replace(/\s+/g, " ").trim())
      .filter((text) => {
        const count = text.split(/\s+/).length;
        return count >= 5 && count <= 40;
      })
      .slice(0, 6);
    return {
      glosses: (sense.glosses ?? []).filter(Boolean),
      rawGlosses: (sense.raw_glosses ?? []).filter(Boolean),
      examples,
      quotations,
      tags: (sense.tags ?? []).filter(Boolean),
      topics: (sense.topics ?? []).filter(Boolean),
    };
  }).filter((sense) => sense.glosses.length);
  if (!senses.length) return null;

  const sounds = (entry.sounds ?? []).flatMap((sound) => {
    const result = [];
    if (sound.ipa) {
      result.push({
        ipa: sound.ipa,
        tags: (sound.tags ?? []).filter(Boolean),
      });
    }
    if (sound.mp3_url || sound.ogg_url) {
      result.push({
        audio: sound.mp3_url || sound.ogg_url,
        tags: (sound.tags ?? []).filter(Boolean),
      });
    }
    return result;
  });

  return {
    word: entry.word,
    pos: POS_MAP[entry.pos] ?? entry.pos ?? "",
    senses,
    sounds,
    translations: (entry.translations ?? [])
      .filter((translation) => (
        translation?.word
        && translation.lang_code === "zh"
        && /Chinese Mandarin/i.test(translation.lang ?? "")
      ))
      .map((translation) => ({
        sense: translation.sense ?? "",
        word: translation.word,
        tags: (translation.tags ?? []).filter(Boolean),
      })),
    forms: (entry.forms ?? []).map((form) => ({
      form: form.form,
      tags: (form.tags ?? []).filter(Boolean),
    })).filter((form) => form.form),
  };
}

function wordUrl(word) {
  const lower = word.toLowerCase();
  const first = encodeURIComponent(lower.slice(0, 1));
  const firstTwo = encodeURIComponent(lower.slice(0, 2));
  return `https://kaikki.org/dictionary/English/meaning/${first}/${firstTwo}/${encodeURIComponent(lower)}.jsonl`;
}

async function fetchWord(word, attempt = 0) {
  try {
    const response = await fetch(wordUrl(word), {
      headers: { "user-agent": "sense-vocab-data-builder/1.0" },
      signal: AbortSignal.timeout(25_000),
    });
    if (response.status === 404) return { version: CACHE_VERSION, entries: [] };
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) {
      return { version: CACHE_VERSION, error: `HTTP ${response.status}`, entries: [] };
    }
    const text = await response.text();
    const entries = text.split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const compact = compactEntry(JSON.parse(line));
          return compact ? [compact] : [];
        } catch {
          return [];
        }
      })
      .filter((entry) => entry.word.toLowerCase() === word.toLowerCase());
    return { version: CACHE_VERSION, entries };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 700 * (2 ** attempt)));
      return fetchWord(word, attempt + 1);
    }
    return {
      version: CACHE_VERSION,
      error: error?.message ?? String(error),
      entries: [],
    };
  }
}

async function main() {
  const words = JSON.parse(await readFile(inputPath, "utf8"));
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    cache = {};
  }
  const queue = words
    .map((word) => word.word)
    .filter((word) => cache[word]?.version !== CACHE_VERSION);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const word = queue[index];
      cache[word] = await fetchWord(word);
      completed += 1;
      if (completed % 25 === 0 || completed === queue.length) {
        console.log(`Fetched ${completed}/${queue.length}: ${word}`);
        await writeJsonAtomic(cachePath, cache);
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await writeJsonAtomic(cachePath, cache);

  const report = {
    words: words.length,
    matchedWords: words.filter((word) => cache[word.word]?.entries?.length).length,
    wordsWithExamples: words.filter((word) => (
      cache[word.word]?.entries?.some((entry) => (
        entry.senses.some((sense) => sense.examples.length)
      ))
    )).length,
    wordsWithAudio: words.filter((word) => (
      cache[word.word]?.entries?.some((entry) => (
        entry.sounds.some((sound) => sound.audio)
      ))
    )).length,
    errors: Object.values(cache).filter((entry) => entry?.error).length,
  };
  await writeJsonAtomic(reportPath, report, true);
  console.log(JSON.stringify(report, null, 2));
}

await main();
