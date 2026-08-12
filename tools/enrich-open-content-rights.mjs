import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const vocabularyPaths = [
  path.join(dataDir, "vocabulary-bundle.json"),
  path.join(dataDir, "kaoyan-words.json"),
];
const cachePath = path.join(dataDir, "tatoeba-rights-cache.json");
const tatoebaApi = "https://api.tatoeba.org/v1/sentences";
const tatoebaExportRoot = "https://downloads.tatoeba.org/exports/per_language/eng";
const detailedExportUrl = `${tatoebaExportRoot}/eng_sentences_detailed.tsv.bz2`;
const cc0ExportUrl = `${tatoebaExportRoot}/eng_sentences_CC0.tsv.bz2`;
const detailedArchivePath = path.join(dataDir, "tatoeba-eng-detailed.tsv.bz2");
const cc0ArchivePath = path.join(dataDir, "tatoeba-eng-cc0.tsv.bz2");
const concurrency = 4;

function sha256(value) {
  return createHash("sha256")
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest("hex");
}

function legacyBufferSha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function isRedundantTerminalPeriodMismatch(localText, sourceText) {
  const local = String(localText ?? "");
  const source = String(sourceText ?? "");
  return local === `${source}.` && /[.!?;:"'”’]$/.test(source);
}

function wordsOf(value) {
  const words = Array.isArray(value) ? value : value.words;
  if (!Array.isArray(words)) throw new Error("Vocabulary file has no word array.");
  return words;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fetchSentence(id) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(`${tatoebaApi}/${id}`, {
        headers: { "User-Agent": "sense-vocab-rights-audit/1.0" },
      });
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        const waitMs = Number.isFinite(retryAfter)
          ? Math.min(Math.max(retryAfter * 1000, 1000), 60000)
          : Math.min(1500 * 2 ** attempt, 60000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (!response.ok) throw new Error(`Tatoeba API ${id} returned ${response.status}`);
      const payload = await response.json();
      const data = payload?.data;
      if (!data || Number(data.id) !== Number(id)) throw new Error(`Tatoeba API ${id} had no record`);
      const record = {
        id: Number(data.id),
        text: String(data.text ?? ""),
        language: String(data.lang ?? ""),
        license: String(data.license ?? ""),
        owner: data.owner === null ? null : String(data.owner ?? ""),
        ownerStatus: data.owner === null ? "unowned" : "named",
        sourcePage: `https://tatoeba.org/en/sentences/show/${id}`,
        apiRecord: `${tatoebaApi}/${id}`,
        fetchedAt: new Date().toISOString(),
      };
      record.evidenceSha256 = sha256(JSON.stringify(record));
      return record;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function downloadArchive(url, filePath, previous = {}) {
  let head;
  try {
    head = await fetch(url, { method: "HEAD", headers: { "User-Agent": "sense-vocab-rights-audit/1.0" } });
    if (!head.ok) throw new Error(`Tatoeba export HEAD returned ${head.status}: ${url}`);
  } catch (error) {
    const cachedBytes = await readFile(filePath);
    const cachedHash = sha256(cachedBytes);
    const knownHashMatches = previous.sha256 === cachedHash ||
      previous.sha256 === legacyBufferSha256(cachedBytes);
    if (!knownHashMatches) throw error;
    console.log(`Using hash-verified cached Tatoeba export after HEAD failure: ${url}`);
    return { ...previous, url, filePath, sha256: cachedHash, bytes: cachedBytes.length };
  }
  const lastModified = head.headers.get("last-modified") ?? "";
  const etag = head.headers.get("etag") ?? "";
  const contentLength = Number(head.headers.get("content-length") ?? 0);
  let bytes;
  try {
    const candidate = await readFile(filePath);
    const metadataMatches = previous.lastModified === lastModified && previous.etag === etag;
    const lengthMatches = contentLength > 0 && candidate.length === contentLength;
    if (metadataMatches || lengthMatches) bytes = candidate;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!bytes) {
    const response = await fetch(url, { headers: { "User-Agent": "sense-vocab-rights-audit/1.0" } });
    if (!response.ok) throw new Error(`Tatoeba export download returned ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, bytes);
  }
  return {
    url,
    filePath,
    lastModified,
    etag,
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

async function forEachArchiveLine(archivePath, callback) {
  const python = process.platform === "win32" ? "py" : "python3";
  const pythonArgs = process.platform === "win32" ? ["-3"] : [];
  pythonArgs.push(
    "-c",
    "import bz2,shutil,sys; src=bz2.open(sys.argv[1], 'rb'); shutil.copyfileobj(src, sys.stdout.buffer); src.close()",
    archivePath,
  );
  const child = spawn(python, pythonArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) await callback(line);
  const exitCode = await completion;
  if (exitCode !== 0) throw new Error(`bzip2 stream exited ${exitCode}: ${stderr.trim()}`);
}

const documents = await Promise.all(vocabularyPaths.map((filePath) => readJson(filePath, null)));
const ids = new Set();
for (const document of documents) {
  for (const word of wordsOf(document)) {
    for (const sense of word.senses ?? []) {
      if (String(sense.exampleSource ?? "").toLowerCase() === "tatoeba" && sense.exampleSourceId) {
        ids.add(Number(sense.exampleSourceId));
      }
    }
  }
}

const cache = await readJson(cachePath, { formatVersion: 1, source: tatoebaApi, sentences: {} });
cache.formatVersion = 2;
cache.source = "Tatoeba official API v1 and weekly exports";
cache.sentences ??= {};
cache.exports ??= {};

const detailedExport = await downloadArchive(
  detailedExportUrl,
  detailedArchivePath,
  cache.exports[detailedExportUrl],
);
const cc0Export = await downloadArchive(
  cc0ExportUrl,
  cc0ArchivePath,
  cache.exports[cc0ExportUrl],
);
cache.exports[detailedExportUrl] = detailedExport;
cache.exports[cc0ExportUrl] = cc0Export;

const cc0Ids = new Set();
await forEachArchiveLine(cc0ArchivePath, (line) => {
  const id = Number(line.split("\t", 1)[0]);
  if (ids.has(id)) cc0Ids.add(id);
});

let exportMatches = 0;
await forEachArchiveLine(detailedArchivePath, (line) => {
  const fields = line.split("\t");
  const id = Number(fields[0]);
  if (!ids.has(id) || fields.length < 6) return;
  const owner = fields.at(-3) || null;
  const text = fields.slice(2, -3).join("\t");
  const license = cc0Ids.has(id) ? "CC0 1.0" : "CC BY 2.0 FR";
  const record = {
    id,
    text,
    language: fields[1],
    license,
    owner,
    ownerStatus: owner ? "named" : "unowned",
    sourcePage: `https://tatoeba.org/en/sentences/show/${id}`,
    metadataRecord: detailedExportUrl,
    fetchedAt: new Date(detailedExport.lastModified || "2026-08-08T06:28:00Z").toISOString(),
    sourceSnapshot: {
      detailedExportSha256: detailedExport.sha256,
      cc0ExportSha256: cc0Export.sha256,
      detailedLastModified: detailedExport.lastModified,
      cc0LastModified: cc0Export.lastModified,
    },
  };
  record.evidenceSha256 = sha256(JSON.stringify(record));
  cache.sentences[id] = record;
  exportMatches += 1;
});
console.log(`Tatoeba weekly export matches: ${exportMatches}/${ids.size}.`);

const pending = [...ids].filter((id) => !cache.sentences[id]);
console.log(`Tatoeba metadata: ${ids.size} records, ${pending.length} pending.`);

let cursor = 0;
async function worker() {
  while (cursor < pending.length) {
    const index = cursor++;
    const id = pending[index];
    cache.sentences[id] = await fetchSentence(id);
    if ((index + 1) % 50 === 0 || index + 1 === pending.length) {
      cache.updatedAt = new Date().toISOString();
      await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
      console.log(`Fetched ${index + 1}/${pending.length}.`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

let tatoebaApplied = 0;
let wiktionaryApplied = 0;
let mismatches = 0;
for (let documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
  const document = documents[documentIndex];
  for (const word of wordsOf(document)) {
    for (const sense of word.senses ?? []) {
      const source = String(sense.exampleSource ?? "").toLowerCase();
      if (source === "tatoeba" && sense.exampleSourceId) {
        const record = cache.sentences[Number(sense.exampleSourceId)];
        if (record) {
          sense.exampleLicense = record.license || sense.exampleLicense || "CC BY 2.0 FR";
          sense.exampleOwner = record.owner;
          sense.exampleOwnerStatus = record.ownerStatus;
          sense.exampleAttribution = record.owner
            ? `${record.owner} / Tatoeba / ${sense.exampleLicense}`
            : `Tatoeba sentence ${record.id} (unowned) / ${sense.exampleLicense}`;
          sense.exampleSourcePage = record.sourcePage;
          sense.exampleMetadataSource = record.metadataRecord
            ? "Tatoeba weekly official exports"
            : "Tatoeba API v1";
          sense.exampleMetadataRecord = record.metadataRecord ?? record.apiRecord;
          sense.exampleMetadataFetchedAt = record.fetchedAt;
          if (record.sourceSnapshot) sense.exampleSourceSnapshot = record.sourceSnapshot;
          if (isRedundantTerminalPeriodMismatch(sense.example, record.text)) {
            sense.exampleNormalization = {
              type: "removed-redundant-terminal-period",
              previousSha256: sha256(sense.example),
              sourceTextSha256: sha256(record.text),
              appliedAt: "2026-08-09",
            };
            sense.example = record.text;
          }
          sense.exampleRightsEvidenceSha256 = record.evidenceSha256;
          sense.exampleMetadataStatus = record.text === sense.example ? "verified" : "text-mismatch";
          if (sense.exampleMetadataStatus === "text-mismatch") mismatches += 1;
          tatoebaApplied += 1;
        }
      }

      if (source.includes("kaikki") || source.includes("wiktionary")) {
        const page = `https://en.wiktionary.org/wiki/${encodeURIComponent(word.word)}#English`;
        sense.exampleSourceId ??= `enwiktionary:${word.id}:${sense.id}`;
        sense.exampleOwner = "Wiktionary contributors";
        sense.exampleLicense = "CC BY-SA 4.0";
        sense.exampleLicenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/";
        sense.exampleSourcePage = page;
        sense.exampleHistoryPage =
          `https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(word.word)}&action=history`;
        sense.exampleCopyrightPage = "https://en.wiktionary.org/wiki/Wiktionary:Copyrights";
        sense.exampleAttribution =
          `Wiktionary contributors / ${sense.exampleLicense} / modified by Sense Vocab`;
        sense.exampleMetadataSource = "Kaikki/Wiktionary official source pages";
        sense.exampleMetadataFetchedAt = "2026-08-09T00:00:00.000Z";
        sense.exampleSourceSnapshot =
          "Kaikki extraction 2026-07-25 from enwiktionary dump 2026-07-06";
        sense.exampleRightsEvidenceSha256 = sha256(JSON.stringify({
          source: sense.exampleSource,
          sourceId: sense.exampleSourceId,
          sourcePage: sense.exampleSourcePage,
          historyPage: sense.exampleHistoryPage,
          copyrightPage: sense.exampleCopyrightPage,
          license: sense.exampleLicense,
          licenseUrl: sense.exampleLicenseUrl,
          snapshot: sense.exampleSourceSnapshot,
        }));
        wiktionaryApplied += 1;
      }

      if (/kaikki|wiktionary/i.test(String(sense.ipaSource ?? ""))) {
        sense.ipaAuthor = "Wiktionary contributors";
        sense.ipaLicense = "CC BY-SA 4.0";
        sense.ipaLicenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/";
        sense.ipaSourcePage =
          `https://en.wiktionary.org/wiki/${encodeURIComponent(word.word)}#English`;
      }
    }
  }
  if (document.sources?.ielts?.content && /kaikki/i.test(document.sources.ielts.content.name ?? "")) {
    document.sources.ielts.content.license =
      "CC BY-SA 4.0 / GFDL 1.3; Sense Vocab relies on CC BY-SA 4.0";
  }
  const preservePrettyCrLf = vocabularyPaths[documentIndex].endsWith("kaoyan-words.json");
  let serialized = JSON.stringify(document, null, preservePrettyCrLf ? 2 : undefined);
  serialized = preservePrettyCrLf
    ? `${serialized.replace(/\r?\n/g, "\r\n")}\r\n`
    : `${serialized}\n`;
  await writeFile(vocabularyPaths[documentIndex], serialized, "utf8");
}

console.log(`Applied Tatoeba metadata to ${tatoebaApplied} records.`);
console.log(`Applied Wiktionary/Kaikki metadata to ${wiktionaryApplied} records.`);
console.log(`Tatoeba text mismatches: ${mismatches}.`);
