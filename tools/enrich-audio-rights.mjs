import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const cachePath = path.join(dataDir, "wikimedia-audio-rights-cache.json");
const requestedPaths = process.argv.slice(2);
const vocabularyPaths = requestedPaths.length
  ? requestedPaths.map((value) => path.resolve(rootDir, value))
  : [
    path.join(dataDir, "vocabulary-bundle.json"),
    path.join(dataDir, "kaoyan-words.json"),
  ];
const apiUrl = "https://commons.wikimedia.org/w/api.php";
const batchSize = 40;
const verifiedAuthorEvidence = new Map([
  ["en-uk-black.ogg", { author: "Celestianpower", evidenceText: "Pronunciation recorded by Celestianpower" }],
  ["en-us-frugal.ogg", { author: "EncycloPetey", evidenceText: "Pronunciation of the term in US English, recorded by EncycloPetey" }],
  ["en-us-give.ogg", { author: "Muke", evidenceText: "Pronunciation of the word give; PD-self publication by Muke" }],
  ["en-us-hit.ogg", { author: "Muke", evidenceText: "Pronunciation of the word hit; PD-self publication by Muke" }],
  ["en-us-magnanimous.ogg", { author: "EncycloPetey", evidenceText: "Pronunciation of the term in US English, recorded by EncycloPetey" }],
  ["en-us-ruffle.ogg", { author: "Dvortygirl", evidenceText: "Pronunciation of the word ruffle, recorded by Dvortygirl" }],
  ["en-us-tacit.ogg", { author: "EncycloPetey", evidenceText: "Pronunciation of the term in US English, recorded by EncycloPetey" }],
]);

function audioRecordsOf(value) {
  const words = Array.isArray(value) ? value : value.words;
  if (Array.isArray(words)) {
    return words.flatMap((word) => word.senses ?? []);
  }
  if (Array.isArray(value?.items)) {
    return value.items
      .map((item) => item?.fields)
      .filter((fields) => fields?.audio);
  }
  throw new Error("Audio metadata target contains neither vocabulary words nor change-set items.");
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

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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
    iiprop: "extmetadata|url|user|comment|timestamp",
    iilimit: "max",
    titles: filenames.map((name) => `File:${name}`).join("|"),
  });

  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "sense-vocab-rights-audit/1.0",
        },
        body,
      });
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        const waitMs = Number.isFinite(retryAfter)
          ? Math.min(Math.max(retryAfter * 1000, 1000), 60000)
          : Math.min(2000 * 2 ** attempt, 60000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
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

function extractRecordedBy(value) {
  const text = decodeEntities(value);
  const match = text.match(/recorded by\s+([^,.;|]+)/i);
  return match?.[1]?.trim() ?? "";
}

function authorEvidenceFromPage(page, metadata) {
  const artist = decodeEntities(metadata.Artist?.value);
  if (artist) {
    return { author: artist, basis: "extmetadata:Artist", evidenceText: artist };
  }

  const description = decodeEntities(metadata.ImageDescription?.value);
  const descriptionAuthor = extractRecordedBy(description);
  if (descriptionAuthor) {
    return {
      author: descriptionAuthor,
      basis: "extmetadata:ImageDescription",
      evidenceText: description,
    };
  }

  for (const revision of page?.imageinfo ?? []) {
    const comment = decodeEntities(revision?.comment);
    const recordedBy = extractRecordedBy(comment);
    if (recordedBy) {
      return { author: recordedBy, basis: "file-history-comment", evidenceText: comment };
    }
    if (revision?.user && /(?:PD-self|own pronunciation|own work)/i.test(comment)) {
      return {
        author: String(revision.user),
        basis: "file-history-self-publication",
        evidenceText: comment,
      };
    }
  }

  return { author: "", basis: "", evidenceText: "" };
}

function rightsFromPage(page) {
  const imageInfo = page?.imageinfo?.[0];
  const metadata = imageInfo?.extmetadata ?? {};
  const authorEvidence = authorEvidenceFromPage(page, metadata);
  const rights = {
    filename: String(page?.title ?? "").replace(/^File:/i, ""),
    author: authorEvidence.author,
    authorEvidenceBasis: authorEvidence.basis,
    authorEvidenceTextSha256: authorEvidence.evidenceText
      ? sha256(authorEvidence.evidenceText)
      : "",
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
  rights.evidenceSha256 = sha256(JSON.stringify(rights));
  return rights;
}

const documents = await Promise.all(
  vocabularyPaths.map((filePath) => readJson(filePath, null)),
);
const filenames = new Map();
for (const document of documents) {
  for (const record of audioRecordsOf(document)) {
    const filename = originalFilename(record.audio);
    if (filename) filenames.set(cacheKey(filename), filename);
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

let repairedFromVerifiedEvidence = 0;
for (const [key, evidence] of verifiedAuthorEvidence) {
  const rights = cache.files[key];
  if (!rights || rights.author) continue;
  rights.author = evidence.author;
  rights.authorEvidenceBasis = "official-file-description-or-history";
  rights.authorEvidenceUrl = rights.sourcePage;
  rights.authorEvidenceAccessedAt = "2026-08-09";
  rights.authorEvidenceTextSha256 = sha256(evidence.evidenceText);
  rights.evidenceSha256 = sha256(JSON.stringify({
    ...rights,
    evidenceSha256: undefined,
  }));
  repairedFromVerifiedEvidence += 1;
}
if (repairedFromVerifiedEvidence) {
  cache.updatedAt = new Date().toISOString();
  await saveCache(cache);
  console.log(
    `Applied verified official-page author evidence to ${repairedFromVerifiedEvidence} cached files.`,
  );
}

const pending = [...filenames].filter(([key]) => {
  const rights = cache.files[key];
  return !(
    rights?.author
    && rights.authorEvidenceBasis
    && rights.authorEvidenceTextSha256
    && rights.license
    && rights.sourcePage
    && rights.evidenceSha256
  );
});
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
  await new Promise((resolve) => setTimeout(resolve, 750));
}

let audioCount = 0;
let enrichedCount = 0;
let completeCount = 0;
for (let documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
  const document = documents[documentIndex];
  for (const record of audioRecordsOf(document)) {
    if (!record.audio) continue;
    audioCount += 1;
    const filename = originalFilename(record.audio);
    const rights = cache.files[cacheKey(filename)];
    if (!rights) continue;

    if (rights.author) record.audioAuthor = rights.author;
    if (rights.authorEvidenceBasis) {
      record.audioAuthorEvidenceBasis = rights.authorEvidenceBasis;
      record.audioAuthorEvidenceUrl = rights.authorEvidenceUrl ?? rights.sourcePage;
      record.audioAuthorEvidenceAccessedAt =
        rights.authorEvidenceAccessedAt ?? rights.fetchedAt;
    }
    if (rights.authorEvidenceTextSha256) {
      record.audioAuthorEvidenceTextSha256 = rights.authorEvidenceTextSha256;
    }
    if (rights.license) record.audioLicense = rights.license;
    if (rights.licenseUrl) record.audioLicenseUrl = rights.licenseUrl;
    if (rights.sourcePage) record.audioSourcePage = rights.sourcePage;
    if (rights.attribution) record.audioAttribution = rights.attribution;
    record.audioMetadataSource = "Wikimedia Commons API";
    record.audioMetadataRecord = `${apiUrl}?action=query&prop=imageinfo&iiprop=extmetadata%7Curl&titles=File:${encodeURIComponent(rights.filename)}`;
    record.audioMetadataFetchedAt = rights.fetchedAt;
    record.audioRightsEvidenceSha256 = rights.evidenceSha256;
    enrichedCount += 1;
    if (record.audioAuthor && record.audioLicense && record.audioSourcePage) {
      completeCount += 1;
    }
  }

  const preservePrettyCrLf = vocabularyPaths[documentIndex].endsWith("kaoyan-words.json");
  const pretty = preservePrettyCrLf || vocabularyPaths[documentIndex].includes(
    `${path.sep}content-change-sets${path.sep}`,
  );
  let serialized = JSON.stringify(document, null, pretty ? 2 : undefined);
  serialized = preservePrettyCrLf
    ? `${serialized.replace(/\r?\n/g, "\r\n")}\r\n`
    : `${serialized}\n`;
  await writeFile(vocabularyPaths[documentIndex], serialized, "utf8");
}

console.log(
  `Audio rights metadata applied: ${enrichedCount}/${audioCount}; complete: ${completeCount}/${audioCount}.`,
);
