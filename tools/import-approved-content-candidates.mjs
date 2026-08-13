import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fieldSha256(value) {
  return sha256(JSON.stringify(value ?? null));
}

function sourceValueSha256(value) {
  return sha256(String(value ?? "null"));
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

const candidatePath = path.resolve(requireValue(
  argument("--candidate"),
  "Usage: node tools/import-approved-content-candidates.mjs --candidate <file> --expected-sha256 <sha256> --output <manifest>",
));
const expectedCandidateSha256 = requireValue(
  argument("--expected-sha256"),
  "Missing --expected-sha256.",
);
const outputPath = path.resolve(rootDir, requireValue(
  argument("--output"),
  "Missing --output.",
));
const reviewedAt = argument("--reviewed-at", new Date().toISOString());
const sourcePath = outputPath.replace(/\.json$/i, "-source.json");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const priorManifestPath = path.join(
  rootDir,
  "data",
  "content-change-sets",
  "op-fb-2026-08-12-a.json",
);

const [candidateBytes, bundleBytes, priorManifestBytes] = await Promise.all([
  readFile(candidatePath),
  readFile(bundlePath),
  readFile(priorManifestPath),
]);
const candidateSha256 = sha256(candidateBytes);
if (candidateSha256 !== expectedCandidateSha256) {
  throw new Error(`Candidate package hash mismatch: ${candidateSha256}`);
}

const candidate = JSON.parse(candidateBytes.toString("utf8"));
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const priorManifest = JSON.parse(priorManifestBytes.toString("utf8"));
if (sha256(bundleBytes) !== candidate.baselines?.runtimeBundleSha256) {
  throw new Error("Runtime vocabulary bundle no longer matches the reviewed candidate baseline.");
}
if (!candidate.validation?.requiredEvidenceComplete ||
  candidate.validation?.d019CandidateBlockers !== 0) {
  throw new Error("Candidate evidence is incomplete or contains D-019 blockers.");
}

const words = new Map(bundle.words.map((word) => [word.id, word]));
const candidateFieldsByItem = new Map();
for (const field of candidate.fields ?? []) {
  if (sha256(String(field.candidateValue)) !== field.candidateSha256Utf8) {
    throw new Error(`Candidate value hash mismatch: ${field.contentId}`);
  }
  if (sourceValueSha256(field.oldValue) !== field.oldValueSha256) {
    throw new Error(`Candidate old-value hash mismatch: ${field.contentId}`);
  }
  const fields = candidateFieldsByItem.get(field.batchItemId) ?? [];
  fields.push(field);
  candidateFieldsByItem.set(field.batchItemId, fields);
}

const items = candidate.items.map((candidateItem) => {
  const word = words.get(candidateItem.wordId);
  if (!word) throw new Error(`Unknown wordId: ${candidateItem.wordId}`);
  const existingSense = word.senses.find((sense) => sense.id === candidateItem.senseId);
  const action = candidateItem.action === "replace" ? "update" : candidateItem.action;
  if (action === "add" && existingSense) {
    throw new Error(`Proposed sense already exists: ${candidateItem.wordId}:${candidateItem.senseId}`);
  }
  if (action === "update" && !existingSense) {
    throw new Error(`Update target is missing: ${candidateItem.wordId}:${candidateItem.senseId}`);
  }

  const fields = {};
  const expectedOldValueSha256 = {};
  const fieldEvidence = {};
  for (const candidateField of candidateFieldsByItem.get(candidateItem.batchItemId) ?? []) {
    const runtimeValue = existingSense?.[candidateField.field] ?? null;
    if (sourceValueSha256(runtimeValue) !== candidateField.oldValueSha256) {
      throw new Error(`Runtime old value changed: ${candidateField.contentId}`);
    }
    fields[candidateField.field] = candidateField.candidateValue;
    expectedOldValueSha256[candidateField.field] = fieldSha256(runtimeValue);
    fieldEvidence[candidateField.field] = {
      origin: candidateField.candidateOrigin,
      candidateSha256Utf8: candidateField.candidateSha256Utf8,
      oldValueSha256: candidateField.oldValueSha256,
      sourceIds: (candidateField.directInputSources ?? []).map((source) => source.sourceId),
      license: candidateField.licenseNameVersion,
    };
  }

  if (action === "add") {
    fields.pos = candidateItem.pos;
    fields.synsetId = candidateItem.synsetId;
    for (const [field, value] of Object.entries({
      pos: candidateItem.pos,
      synsetId: candidateItem.synsetId,
    })) {
      expectedOldValueSha256[field] = fieldSha256(null);
      fieldEvidence[field] = {
        origin: candidateItem.synsetId
          ? "wordnet_3_0_semantic_identity"
          : "approved_project_semantic_identity",
        candidateSha256Utf8: sha256(String(value ?? "null")),
        oldValueSha256: fieldSha256(null),
        sourceIds: candidateItem.synsetId
          ? ["E-WORDNET-3.0"]
          : ["E-ANONYMIZED-SEMANTIC-LOCATOR", "E-CODEX-OP-FB-2026-08-13-B"],
        license: candidateItem.synsetId
          ? "WordNet Release 3.0 License"
          : "Project-owned semantic identity decision",
      };
    }
  }

  return {
    itemId: candidateItem.batchItemId,
    wordId: candidateItem.wordId,
    senseId: candidateItem.senseId,
    action,
    bookIds: candidateItem.candidateBookScope,
    importance: action === "add" ? Math.max(1, 100 - word.senses.length * 3) : undefined,
    identityEvidenceStatus: candidateItem.identityEvidenceStatus,
    fields,
    expectedOldValueSha256,
    fieldEvidence,
  };
});

const sourceRelativePath = path.relative(rootDir, sourcePath).replaceAll(path.sep, "/");
const generationEvidence = candidate.evidenceCatalog["E-CODEX-OP-FB-2026-08-13-B"];
const manifest = {
  schemaVersion: 2,
  batchId: candidate.batchId,
  purpose: "Apply the user-approved CD feedback batch without changing existing stable identities or deleting user data.",
  sourcePackage: {
    path: sourceRelativePath,
    sha256: candidateSha256,
    inputManifestSha256: candidate.inputManifestSha256,
    outputManifestSha256: candidate.outputManifestSha256,
  },
  baseline: candidate.baselines,
  review: {
    status: "approved",
    reviewerRole: "product owner",
    reviewedAt,
    scope: "all candidate fields, proposed stable sense IDs, and candidate book scopes",
  },
  compatibility: {
    strategy: "explicit-new-sense-initialization",
    addedSenseKeys: items
      .filter((item) => item.action === "add")
      .map((item) => `${item.wordId}:${item.senseId}`),
    behavior: "Existing introduced words initialize approved added senses as selectable new senses and retain every prior sense state.",
  },
  generation: {
    supplier: generationEvidence.supplier,
    model: generationEvidence.model,
    visibleVersion: generationEvidence.visibleVersion,
    weightsSource: generationEvidence.weightsSource,
    generationSession: generationEvidence.generationSession,
    prompt: generationEvidence.prompt,
    promptSha256Utf8: generationEvidence.promptSha256,
  },
  rights: {
    ...priorManifest.rights,
    wordnet: {
      author: candidate.evidenceCatalog["E-WORDNET-3.0"].authorOrRightsHolder,
      license: candidate.evidenceCatalog["E-WORDNET-3.0"].licenseNameVersion,
      sourceUrl: priorManifest.rights.wordnet.sourceUrl,
      localEvidence: candidate.evidenceCatalog["E-WORDNET-3.0"].licenseFile,
      localEvidenceSha256: candidate.evidenceCatalog["E-WORDNET-3.0"].licenseSha256,
    },
    sourcePackage: sourceRelativePath,
    sourcePackageSha256: candidateSha256,
    residualRisk: `${priorManifest.rights.residualRisk} The exact model deployment snapshot remains undisclosed; the reviewed source package and field hashes preserve this batch's evidence.`,
  },
  counts: {
    approvedCandidateFields: candidate.fields.length,
    identityFields: items.filter((item) => item.action === "add").length * 2,
    items: items.length,
  },
  items,
  noChangeItems: [],
};

await Promise.all([
  writeFile(sourcePath, candidateBytes),
  writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  batchId: manifest.batchId,
  items: manifest.items.length,
  approvedCandidateFields: manifest.counts.approvedCandidateFields,
  identityFields: manifest.counts.identityFields,
  sourcePackageSha256: candidateSha256,
}, null, 2));
