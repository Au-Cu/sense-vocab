import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const cachePath = path.join(dataDir, "wikimedia-audio-rights-cache.json");
const vocabularyPaths = [
  path.join(dataDir, "vocabulary-bundle.json"),
  path.join(dataDir, "kaoyan-words.json"),
];
const apiUrl = "https://commons.wikimedia.org/w/api.php";
const batchSize = 40;

function wordsOf(value) {
  const words = Array.isArray(value) ? value : value.words;
  if (!Array.isArray(words)) {
    throw new Error("Vocabulary file does not contain a word array.");
  }
  return words;
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : match;
      }
      return named[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function originalFilename(audioUrl) {
  try {
    const url = new URL(audioUrl);
    if (url.hostname !== "upload.wikimedia.org") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    const transcodedIndex = segments.indexOf("transcoded");
    const filename =
      transcodedIndex >= 0 ? segments.at(-2) : segments.at(-1);
    return decodeURIComponent(filename ?? "");
  } catch {
    return "";
  }
}

function cacheKey(filename) {
  return String(filename ?? "")
    .replace(/^File:/i, "")
    .replaceAll("_", " ")
    .normalize("NFC")
    .toLocaleLowerCase("en-US");
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function saveCache(cache) {
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function fetchBatch(filenames) {
  const body = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "imageinfo",
    iiprop: "extmetadata|url",
    titles: filenames.map((name) => `File:${name}`).join("|"),
  });

  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "sense-vocab-rights-audit/1.0",
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Wikimedia API returned ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(500 * 2 ** attempt, 4000)),
      );
    }
  }
  throw lastError;
}

function rightsFromPage(page) {
  const imageInfo = page?.imageinfo?.[0];
  const metadata = imageInfo?.extmetadata ?? {};
  return {
    filename: String(page?.title ?? "").replace(/^File:/i, ""),
    author: decodeEntities(metadata.Artist?.value),
    license: decodeEntities(
      metadata.LicenseShortName?.value || metadata.UsageTerms?.value,
    ),
    licenseUrl: String(metadata.LicenseUrl?.value ?? "").trim(),
    sourcePage: String(imageInfo?.descriptionurl ?? "").trim(),
    attribution: decodeEntities(
      metadata.Credit?.value || metadata.Attribution?.value,
    ),
    attributionRequired:
      String(metadata.AttributionRequired?.value ?? "").toLowerCase() !== "false",
    fetchedAt: new Date().toISOString(),
  };
}

const documents = await Promise.all(
  vocabularyPaths.map((filePath) => readJson(filePath, null)),
);
const filenames = new Map();
for (const document of documents) {
  for (const word of wordsOf(document)) {
    for (const sense of word.senses ?? []) {
      const filename = originalFilename(sense.audio);
      if (filename) filenames.set(cacheKey(filename), filename);
    }
  }
}

const cache = await readJson(cachePath, {
  formatVersion: 1,
  source: apiUrl,
  files: {},
});
cache.formatVersion = 1;
cache.source = apiUrl;
cache.files ??= {};

const pending = [...filenames].filter(([key]) => !cache.files[key]);
console.log(
  `Wikimedia audio metadata: ${filenames.size} unique files, ${pending.length} pending.`,
);

for (let start = 0; start < pending.length; start += batchSize) {
  const batch = pending.slice(start, start + batchSize);
  const payload = await fetchBatch(batch.map(([, filename]) => filename));
  for (const page of payload?.query?.pages ?? []) {
    if (page?.missing) continue;
    const rights = rightsFromPage(page);
    cache.files[cacheKey(rights.filename)] = rights;
  }
  cache.updatedAt = new Date().toISOString();
  await saveCache(cache);
  console.log(
    `Fetched ${Math.min(start + batch.length, pending.length)}/${pending.length}.`,
  );
}

let audioCount = 0;
let enrichedCount = 0;
let completeCount = 0;
for (let documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
  const document = documents[documentIndex];
  for (const word of wordsOf(document)) {
    for (const sense of word.senses ?? []) {
      if (!sense.audio) continue;
      audioCount += 1;
      const filename = originalFilename(sense.audio);
      const rights = cache.files[cacheKey(filename)];
      if (!rights) continue;

      if (rights.author) sense.audioAuthor = rights.author;
      if (rights.license) sense.audioLicense = rights.license;
      if (rights.licenseUrl) sense.audioLicenseUrl = rights.licenseUrl;
      if (rights.sourcePage) sense.audioSourcePage = rights.sourcePage;
      if (rights.attribution) sense.audioAttribution = rights.attribution;
      sense.audioMetadataSource = "Wikimedia Commons API";
      sense.audioMetadataFetchedAt = rights.fetchedAt;
      enrichedCount += 1;
      if (sense.audioAuthor && sense.audioLicense && sense.audioSourcePage) {
        completeCount += 1;
      }
    }
  }

  await writeFile(
    vocabularyPaths[documentIndex],
    `${JSON.stringify(document)}\n`,
    "utf8",
  );
}

console.log(
  `Audio rights metadata applied: ${enrichedCount}/${audioCount}; complete: ${completeCount}/${audioCount}.`,
);
