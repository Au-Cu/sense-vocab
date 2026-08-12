import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const ledgerPath = path.join(rootDir, "data", "content-rights-ledger.jsonl");
const summaryPath = path.join(rootDir, "data", "content-rights-ledger-summary.json");
const check = process.argv.includes("--check");
const changeSetDir = path.join(rootDir, "data", "content-change-sets");

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
const auditDate = "2026-08-09";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fieldHash(value) {
  return sha256(JSON.stringify(value ?? null));
}

const reviewedFieldRights = new Map();

function reviewedRights(word, sense, field, value) {
  const row = reviewedFieldRights.get(`${word.id}:${sense.id}:${field}`);
  if (!row || row.newValueSha256 !== fieldHash(value) || row.risk !== "CLEARED") {
    return null;
  }
  return {
    source: `reviewed-change-set:${row.batchId}`,
    sourceId: row.itemId,
    author: row.authorOrRightsholder,
    license: row.license,
    sourceUrl: row.directSource,
    retrievedAt: row.acquiredAt,
    evidenceSha256: row.evidenceSha256,
  };
}

function record(field, value, metadata, issues = []) {
  const normalizedIssues = [...issues];
  if (value !== null && value !== undefined && value !== "") {
    const missing = ["author", "license", "sourceUrl"].filter(
      (key) => !String(metadata[key] ?? "").trim(),
    );
    if (missing.length) {
      normalizedIssues.push({
        code: "rights-metadata-incomplete",
        severity: "BLOCKER",
        missing,
      });
    }
  }
  const risk = normalizedIssues.some((issue) => issue.severity === "BLOCKER")
    ? "BLOCKER"
    : normalizedIssues.some((issue) => issue.severity === "HIGH")
      ? "HIGH"
      : normalizedIssues.length
        ? "REVIEW"
        : "CLEARED";
  return {
    field,
    sha256: fieldHash(value),
    source: metadata.source ?? null,
    sourceId: metadata.sourceId ?? null,
    author: metadata.author ?? null,
    license: metadata.license ?? null,
    sourceUrl: metadata.sourceUrl ?? null,
    retrievedAt: metadata.retrievedAt ?? null,
    evidenceSha256: metadata.evidenceSha256 ?? null,
    risk,
    issues: normalizedIssues,
  };
}

function exampleRights(word, sense) {
  const reviewed = reviewedRights(word, sense, "example", sense.example);
  if (reviewed) return record("example", sense.example, reviewed);
  const source = String(sense.exampleSource ?? "");
  const lower = source.toLowerCase();
  const issues = [];
  let author = sense.exampleOwner ?? null;
  let license = sense.exampleLicense ?? null;
  let sourceUrl = sense.exampleSourcePage ?? null;
  let sourceId = sense.exampleSourceId ?? null;
  let evidenceSha256 = sense.exampleRightsEvidenceSha256 ?? null;

  if (lower === "tatoeba") {
    if (!sourceId || !license || (!author && sense.exampleOwnerStatus !== "unowned") ||
      !sourceUrl || !evidenceSha256) {
      issues.push({ code: "tatoeba-attribution-incomplete", severity: "BLOCKER" });
    }
    if (sense.exampleMetadataStatus !== "verified") {
      issues.push({ code: "tatoeba-record-not-text-verified", severity: "BLOCKER" });
    }
  } else if (lower.includes("kaikki") || lower.includes("wiktionary")) {
    if (!sourceId || !author || !license || !sourceUrl || !evidenceSha256) {
      issues.push({ code: "wiktionary-attribution-incomplete", severity: "BLOCKER" });
    }
    if (lower.includes("quotation")) {
      issues.push({ code: "underlying-quotation-rights-unresolved", severity: "BLOCKER" });
    }
  } else if (lower === "semcor") {
    issues.push({ code: "semcor-commercial-rights-unverified", severity: "BLOCKER" });
  } else if (lower === "wordnet-example") {
    author ??= "Princeton University";
    license ??= "WordNet 3.0 License";
    sourceUrl ??= "https://wordnet.princeton.edu/license-and-commercial-use";
    sourceId ??= sense.synsetId ?? null;
  } else if (lower.startsWith("semantic-")) {
    if (!sourceId || !license) {
      issues.push({ code: "semantic-example-untraceable", severity: "BLOCKER" });
    }
  } else if (lower.startsWith("manual") || lower.includes("override")) {
    issues.push({ code: "internal-authorship-record-missing", severity: "HIGH" });
  } else if (sense.example && !source) {
    issues.push({ code: "example-source-missing", severity: "BLOCKER" });
  }
  return record("example", sense.example, {
    source, sourceId, author, license, sourceUrl,
    retrievedAt: sense.exampleMetadataFetchedAt,
    evidenceSha256,
  }, issues);
}

function audioRights(sense) {
  if (!sense.audio) return null;
  const issues = [];
  if (!sense.audioAuthor || !sense.audioLicense || !sense.audioSourcePage ||
    !sense.audioRightsEvidenceSha256) {
    issues.push({ code: "audio-file-rights-incomplete", severity: "BLOCKER" });
  }
  return record("audio", sense.audio, {
    source: sense.audioMetadataSource ?? "remote-audio",
    sourceId: sense.audioMetadataRecord,
    author: sense.audioAuthor,
    license: sense.audioLicense,
    sourceUrl: sense.audioSourcePage,
    retrievedAt: sense.audioMetadataFetchedAt,
    evidenceSha256: sense.audioRightsEvidenceSha256,
  }, issues);
}

function translationRights(word, sense, field, value, source) {
  const reviewed = reviewedRights(word, sense, field, value);
  if (reviewed) return record(field, value, reviewed);
  const lower = String(source ?? "").toLowerCase();
  const issues = [];
  let author = null;
  let license = null;
  let sourceUrl = null;
  if (/google|translate\.google/.test(lower)) {
    issues.push({ code: "unofficial-google-translation-source", severity: "BLOCKER" });
  } else if (/argos|opus/.test(lower)) {
    author = "Jörg Tiedemann and Santhosh Thottingal";
    license = "CC BY 4.0";
    sourceUrl = "https://www.argosopentech.com/argospm/index/";
  } else if (value && !source) {
    issues.push({ code: "translation-source-missing", severity: "BLOCKER" });
  } else if (value && /aligned|cleanup|rewrite|repair/.test(lower)) {
    issues.push({ code: "internal-translation-authorship-record-missing", severity: "HIGH" });
  }
  return record(field, value, { source, author, license, sourceUrl }, issues);
}

const bundleBytes = await readFile(bundlePath);
const bundleHash = sha256(bundleBytes);
const bundle = JSON.parse(bundleBytes.toString("utf8"));
try {
  const files = (await readdir(changeSetDir))
    .filter((name) => name.endsWith("-rights-ledger.json"));
  for (const name of files) {
    const ledger = JSON.parse(await readFile(path.join(changeSetDir, name), "utf8"));
    for (const row of ledger.rows ?? []) {
      reviewedFieldRights.set(row.assetId, row);
    }
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const lines = [];
const counts = { senses: 0, CLEARED: 0, REVIEW: 0, HIGH: 0, BLOCKER: 0 };
for (const word of bundle.words) {
  for (const sense of word.senses ?? []) {
    const fields = [];
    const semanticIssues = [];
    if (/cow/i.test(String(sense.meaningSource ?? ""))) {
      semanticIssues.push({ code: "legacy-cow-source-unverified", severity: "BLOCKER" });
    }
    const reviewedMeaning = reviewedRights(word, sense, "meaning", sense.meaning);
    fields.push(record("meaning", sense.meaning, reviewedMeaning ?? {
      source: sense.meaningSource,
      sourceId: sense.synsetId,
      author: sense.synsetId ? "Princeton WordNet / Open Multilingual Wordnet contributors" : null,
      license: sense.synsetId ? "WordNet 3.0 License / CC BY 4.0 as applicable" : null,
      sourceUrl: sense.synsetId ? "https://omwn.org/" : null,
    }, reviewedMeaning ? [] : semanticIssues));
    const reviewedDefinition = reviewedRights(word, sense, "definition", sense.definition);
    fields.push(record("definition", sense.definition, reviewedDefinition ?? {
      source: sense.definitionSource ?? (sense.synsetId ? "WordNet synset" : null),
      sourceId: sense.synsetId,
      author: sense.synsetId ? "Princeton University" : null,
      license: sense.synsetId ? "WordNet 3.0 License" : null,
      sourceUrl: sense.synsetId ? "https://wordnet.princeton.edu/license-and-commercial-use" : null,
    }, reviewedDefinition ? [] : sense.definition && !sense.definitionSource && !sense.synsetId
      ? [{ code: "definition-source-missing", severity: "BLOCKER" }]
      : []));
    fields.push(exampleRights(word, sense));
    fields.push(translationRights(word, sense, "definitionZh", sense.definitionZh, sense.definitionZhSource));
    fields.push(translationRights(word, sense, "exampleZh", sense.exampleZh, sense.exampleZhSource));
    const reviewedIpa = reviewedRights(word, sense, "ipa", sense.ipa);
    fields.push(record("ipa", sense.ipa, reviewedIpa ?? {
      source: sense.ipaSource,
      author: /cmu/i.test(String(sense.ipaSource ?? "")) ? "Carnegie Mellon University" : sense.ipaAuthor,
      license: /cmu/i.test(String(sense.ipaSource ?? "")) ? "CMUdict BSD-style License" : sense.ipaLicense,
      sourceUrl: /cmu/i.test(String(sense.ipaSource ?? ""))
        ? "https://github.com/cmusphinx/cmudict"
        : sense.ipaSourcePage,
    }, reviewedIpa ? [] : sense.ipa && !sense.ipaSource
      ? [{ code: "ipa-source-missing", severity: "HIGH" }]
      : []));
    const audio = audioRights(sense);
    if (audio) fields.push(audio);

    const riskOrder = ["CLEARED", "REVIEW", "HIGH", "BLOCKER"];
    const releaseDecision = fields.reduce((risk, field) =>
      riskOrder.indexOf(field.risk) > riskOrder.indexOf(risk) ? field.risk : risk,
    "CLEARED");
    const contentHash = sha256(JSON.stringify({
      meaning: sense.meaning, definition: sense.definition, example: sense.example,
      definitionZh: sense.definitionZh, exampleZh: sense.exampleZh,
      ipa: sense.ipa, audio: sense.audio,
    }));
    lines.push(JSON.stringify({
      recordType: "sense",
      assetId: `sense:${word.id}:${sense.id}`,
      path: `data/vocabulary-bundle.json#/words/${word.id}/senses/${sense.id}`,
      wordId: word.id,
      senseId: sense.id,
      contentSha256: contentHash,
      releaseDecision,
      fields,
    }));
    counts.senses += 1;
    counts[releaseDecision] += 1;
  }
}

const header = {
  recordType: "header",
  schemaVersion: 1,
  auditDate,
  bundlePath: "data/vocabulary-bundle.json",
  bundleSha256: bundleHash,
  senseCount: counts.senses,
};
const ledgerContents = `${JSON.stringify(header)}\n${lines.join("\n")}\n`;
const summaryContents = `${JSON.stringify({ ...header, counts }, null, 2)}\n`;
if (check) {
  const [existingLedger, existingSummary] = await Promise.all([
    readFile(ledgerPath, "utf8"),
    readFile(summaryPath, "utf8"),
  ]);
  if (existingLedger !== ledgerContents || existingSummary !== summaryContents) {
    console.error("Content-rights ledger is stale. Run npm run build:rights-ledger.");
    process.exit(1);
  }
} else {
  await writeFileWithRetry(ledgerPath, ledgerContents);
  await writeFileWithRetry(summaryPath, summaryContents);
}
console.log(
  `Content-rights ledger ${check ? "verified" : "written"} for ${counts.senses} senses.`,
);
console.log(JSON.stringify(counts));
