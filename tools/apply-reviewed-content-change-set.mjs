import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const manifestPath = path.join(
  dataDir,
  "content-change-sets",
  "op-fb-2026-08-12-a.json",
);
const bundlePath = path.join(dataDir, "vocabulary-bundle.json");
const ledgerPath = path.join(
  dataDir,
  "content-change-sets",
  "op-fb-2026-08-12-a-rights-ledger.json",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fieldSha256(value) {
  return sha256(JSON.stringify(value ?? null));
}

function fieldRights(field, value, manifest, item) {
  const semanticFields = new Set(["pos", "synsetId"]);
  if (semanticFields.has(field)) {
    return {
      authorOrRightsholder: manifest.rights.wordnet.author,
      directSource: manifest.rights.wordnet.sourceUrl,
      license: manifest.rights.wordnet.license,
      evidenceLocation: manifest.rights.wordnet.localEvidence,
      evidenceSha256: manifest.rights.wordnet.localEvidenceSha256,
      use: "semantic identity and part-of-speech evidence",
    };
  }
  if (field === "ipa") {
    return {
      authorOrRightsholder: manifest.rights.cmudict.author,
      directSource: manifest.rights.cmudict.sourceUrl,
      license: manifest.rights.cmudict.license,
      evidenceLocation: manifest.rights.cmudict.localEvidence,
      evidenceSha256: manifest.rights.cmudict.localEvidenceSha256,
      use: "pronunciation transcription",
    };
  }
  return {
    authorOrRightsholder: manifest.rights.outputAuthor,
    directSource: manifest.rights.outputRightsUrl,
    license: manifest.rights.outputRightsBasis,
    evidenceLocation: manifestPath.replace(`${rootDir}${path.sep}`, ""),
    evidenceSha256: manifest.rights.outputRightsEvidenceSha256Utf8,
    use: item.action === "add" ? "new reviewed vocabulary content" : "reviewed vocabulary correction",
  };
}

function reviewedMetadata(manifest, item) {
  const source = `openai-codex-reviewed:${manifest.batchId}`;
  const metadata = {
    auditStatus: "human-reviewed",
    generationBatchId: manifest.batchId,
    humanReviewStatus: manifest.review.status,
    humanReviewedAt: manifest.review.reviewedAt,
  };
  if (Object.hasOwn(item.fields, "meaning")) metadata.meaningSource = source;
  if (Object.hasOwn(item.fields, "definition") ||
    Object.hasOwn(item.fields, "definitionSentence")) {
    metadata.definitionSource = source;
  }
  if (Object.hasOwn(item.fields, "definitionZh")) metadata.definitionZhSource = source;
  if (Object.hasOwn(item.fields, "example")) metadata.exampleSource = source;
  if (Object.hasOwn(item.fields, "exampleZh")) metadata.exampleZhSource = source;
  return metadata;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const words = new Map(bundle.words.map((word) => [word.id, word]));
const rightsRows = [];

let existingLedger = null;
try {
  existingLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const alreadyApplied = existingLedger?.batchId === manifest.batchId &&
  manifest.items.every((item) => {
    const word = words.get(item.wordId);
    const sense = word?.senses.find((candidate) => candidate.id === item.senseId);
    if (!sense || sense.generationBatchId !== manifest.batchId) return false;
    if (!Object.entries(item.fields).every(([field, value]) =>
      JSON.stringify(sense[field]) === JSON.stringify(value))) return false;
    return (item.bookIds ?? []).every((bookId) => bundle.books
      .find((book) => book.id === bookId)?.entries
      .find((entry) => entry.wordId === item.wordId)?.senseIds.includes(item.senseId));
  });
if (alreadyApplied) {
  for (const item of manifest.items) {
    for (const [field, newValue] of Object.entries(item.fields)) {
      const assetId = `${item.wordId}:${item.senseId}:${field}`;
      const previous = existingLedger.rows.find((row) => row.assetId === assetId);
      if (!previous) throw new Error(`Missing prior rights row: ${assetId}`);
      const rights = fieldRights(field, newValue, manifest, item);
      rightsRows.push({
        ...previous,
        purpose: rights.use,
        authorOrRightsholder: rights.authorOrRightsholder,
        directSource: rights.directSource,
        license: rights.license,
        scope: manifest.rights.permittedUses,
        obligations: manifest.rights.obligations,
        newValueSha256: fieldSha256(newValue),
        evidenceLocation: rights.evidenceLocation,
        evidenceSha256: rights.evidenceSha256,
        residualRisk: manifest.rights.residualRisk,
      });
    }
  }
  const refreshedLedger = {
    ...existingLedger,
    promptSha256Utf8: manifest.generation.promptSha256Utf8,
    rowCount: rightsRows.length,
    rows: rightsRows,
  };
  await writeFile(ledgerPath, `${JSON.stringify(refreshedLedger, null, 2)}\n`, "utf8");
  console.log(`Reviewed content batch ${manifest.batchId} is already applied; rights evidence refreshed.`);
  process.exit(0);
}

for (const item of manifest.items) {
  const word = words.get(item.wordId);
  if (!word) throw new Error(`Unknown wordId: ${item.wordId}`);
  let sense = word.senses.find((candidate) => candidate.id === item.senseId);
  const before = sense ? structuredClone(sense) : null;
  if (item.action === "add") {
    if (sense) throw new Error(`Sense already exists: ${item.wordId}:${item.senseId}`);
    sense = {
      id: item.senseId,
      importance: item.importance,
      ...item.fields,
      ...reviewedMetadata(manifest, item),
      ipa: item.fields.ipa ?? item.ipa ?? word.senses[0]?.ipa ?? null,
      ipaSource: item.ipaSource ?? word.senses[0]?.ipaSource ?? null,
      bookSource: "kaoyan-reviewed-feedback",
    };
    word.senses.push(sense);
    for (const bookId of item.bookIds ?? []) {
      const book = bundle.books.find((candidate) => candidate.id === bookId);
      const entry = book?.entries.find((candidate) => candidate.wordId === item.wordId);
      if (!entry) throw new Error(`Missing ${bookId} entry for ${item.wordId}`);
      if (!entry.senseIds.includes(item.senseId)) entry.senseIds.push(item.senseId);
    }
  } else if (item.action === "update") {
    if (!sense) throw new Error(`Unknown sense: ${item.wordId}:${item.senseId}`);
    Object.assign(sense, item.fields, reviewedMetadata(manifest, item));
  } else {
    throw new Error(`Unsupported action: ${item.action}`);
  }

  for (const [field, newValue] of Object.entries(item.fields)) {
    const oldValue = before?.[field] ?? null;
    const rights = fieldRights(field, newValue, manifest, item);
    rightsRows.push({
      batchId: manifest.batchId,
      itemId: item.itemId,
      assetId: `${item.wordId}:${item.senseId}:${field}`,
      wordId: item.wordId,
      senseId: item.senseId,
      field,
      purpose: rights.use,
      authorOrRightsholder: rights.authorOrRightsholder,
      directSource: rights.directSource,
      acquiredAt: manifest.review.reviewedAt,
      license: rights.license,
      scope: manifest.rights.permittedUses,
      obligations: manifest.rights.obligations,
      modification: item.action,
      oldValueSha256: fieldSha256(oldValue),
      newValueSha256: fieldSha256(newValue),
      evidenceLocation: rights.evidenceLocation,
      evidenceSha256: rights.evidenceSha256,
      processor: "OP automation",
      reviewerRole: manifest.review.reviewerRole,
      reviewStatus: manifest.review.status,
      residualRisk: manifest.rights.residualRisk,
      risk: "CLEARED",
    });
  }
}

for (const item of manifest.noChangeItems) {
  const word = words.get(item.wordId);
  const sense = word?.senses.find((candidate) => candidate.id === item.senseId);
  if (!sense) throw new Error(`No-change target missing: ${item.wordId}:${item.senseId}`);
}

const ledger = {
  schemaVersion: 1,
  batchId: manifest.batchId,
  releaseScope: "ordinary maintenance change set",
  decision: "CLEARED",
  historicalGlobalCommercialGate: "BLOCKED outside this change set",
  promptSha256Utf8: manifest.generation.promptSha256Utf8,
  reviewedAt: manifest.review.reviewedAt,
  rowCount: rightsRows.length,
  rows: rightsRows,
};

await writeFile(bundlePath, JSON.stringify(bundle), "utf8");
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
console.log(
  `Applied ${manifest.items.length} reviewed items and wrote ${rightsRows.length} field-rights records.`,
);
