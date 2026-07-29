import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const auditPath = path.join(dataDir, "ielts-open-content-audit.json");
const cachePath = path.join(dataDir, "ielts-tatoeba-english-cache.json");
const concurrency = Math.max(1, Math.min(6, Number(process.argv[2]) || 4));

async function writeJsonAtomic(targetPath, value) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
}

async function fetchWord(word, attempt = 0) {
  const url = new URL("https://api.tatoeba.org/v1/sentences");
  url.searchParams.set("q", word);
  url.searchParams.set("lang", "eng");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("showtrans", "none");
  url.searchParams.set("word_count", "5-34");
  url.searchParams.set("is_unapproved", "no");
  url.searchParams.set("limit", "50");
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "sense-vocab-data-builder/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) return { error: `HTTP ${response.status}`, data: [] };
    const payload = await response.json();
    return {
      data: (Array.isArray(payload.data) ? payload.data : []).map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        license: sentence.license ?? "CC BY 2.0 FR",
        owner: sentence.owner ?? null,
      })),
    };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (2 ** attempt)));
      return fetchWord(word, attempt + 1);
    }
    return { error: error?.message ?? String(error), data: [] };
  }
}

async function main() {
  const audit = JSON.parse(await readFile(auditPath, "utf8"));
  const words = [...new Set(
    (audit.unresolved ?? []).map((entry) => entry.word).filter(Boolean),
  )];
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    cache = {};
  }
  const queue = words.filter((word) => !Object.hasOwn(cache, word));
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
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await writeJsonAtomic(cachePath, cache);
  console.log(JSON.stringify({
    unresolvedWords: words.length,
    fetchedNow: queue.length,
    cachedWords: Object.keys(cache).length,
    sentences: Object.values(cache)
      .reduce((total, entry) => total + (entry?.data?.length ?? 0), 0),
    errors: Object.values(cache).filter((entry) => entry?.error).length,
  }, null, 2));
}

await main();
