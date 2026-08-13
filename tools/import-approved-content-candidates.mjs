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
const approvedBatchId = argument("--batch-id");
const approvedBookIds = (argument("--book-ids", "") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
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
const modernCandidate = Boolean(candidate.baseline) && Array.isArray(candidate.evidenceCatalog);
const candidateBaseline = modernCandidate
  ? {
      commit: candidate.baseline.gitCommit,
      runtimeBundleSha256: candidate.baseline.bundleSha256,
      identityLockSha256: candidate.baseline.identityLockSha256,
      wordCount: candidate.baseline.wordPool?.wordCount,
      senseCount: candidate.baseline.wordPool?.senseCount,
    }
  : candidate.baselines;
const evidenceCatalog = modernCandidate
  ? Object.fromEntries(candidate.evidenceCatalog.map((entry) => [entry.evidenceId, entry]))
  : candidate.evidenceCatalog;
if (sha256(bundleBytes) !== candidateBaseline?.runtimeBundleSha256) {
  throw new Error("Runtime vocabulary bundle no longer matches the reviewed candidate baseline.");
}
const evidenceComplete = modernCandidate
  ? candidate.counts?.generationBlockers === 0 &&
    candidate.fields?.every((field) => field.status === "待用户审核" && field.evidenceRefs?.length)
  : candidate.validation?.requiredEvidenceComplete &&
    candidate.validation?.d019CandidateBlockers === 0;
if (!evidenceComplete) {
  throw new Error("Candidate evidence is incomplete or contains D-019 blockers.");
}

const words = new Map(bundle.words.map((word) => [word.id, word]));
const candidateFieldsByItem = new Map();
for (const field of candidate.fields ?? []) {
  if (sha256(String(field.candidateValue)) !== field.candidateSha256Utf8) {
    throw new Error(`Candidate value hash mismatch: ${field.contentId}`);
  }
  const expectedOldHash = modernCandidate
    ? field.oldValueSha256JsonUtf8
    : field.oldValueSha256;
  const actualOldHash = modernCandidate
    ? fieldSha256(field.oldValue)
    : sourceValueSha256(field.oldValue);
  if (actualOldHash !== expectedOldHash) {
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
  const action = modernCandidate
    ? candidateItem.action === "propose_append_sense" ? "add" : "update"
    : candidateItem.action === "replace" ? "update" : candidateItem.action;
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
    const expectedOldHash = modernCandidate
      ? candidateField.oldValueSha256JsonUtf8
      : candidateField.oldValueSha256;
    const actualOldHash = modernCandidate
      ? fieldSha256(runtimeValue)
      : sourceValueSha256(runtimeValue);
    if (actualOldHash !== expectedOldHash) {
      throw new Error(`Runtime old value changed: ${candidateField.contentId}`);
    }
    fields[candidateField.field] = candidateField.candidateValue;
    expectedOldValueSha256[candidateField.field] = fieldSha256(runtimeValue);
    fieldEvidence[candidateField.field] = {
      origin: modernCandidate
        ? "independent_ai_assisted_candidate"
        : candidateField.candidateOrigin,
      candidateSha256Utf8: candidateField.candidateSha256Utf8,
      oldValueSha256: expectedOldHash,
      sourceIds: modernCandidate
        ? candidateField.evidenceRefs
        : (candidateField.directInputSources ?? []).map((source) => source.sourceId),
      license: modernCandidate
        ? "OpenAI output under the recorded project terms"
        : candidateField.licenseNameVersion,
    };
  }

  if (action === "add" && modernCandidate && fields.definition && !fields.definitionSentence) {
    fields.definitionSentence = fields.definition;
    expectedOldValueSha256.definitionSentence = fieldSha256(null);
    fieldEvidence.definitionSentence = {
      origin: "derived_from_approved_definition_without_new_expression",
      candidateSha256Utf8: sha256(fields.definition),
      oldValueSha256: fieldSha256(null),
      sourceIds: [`${candidateItem.wordId}:${candidateItem.senseId}:definition`],
      license: "Same approved text and rights basis as definition",
    };
  }

  if (action === "add") {
    fields.pos = candidateItem.pos;
    fields.synsetId = candidateItem.synsetId;
    const wordNetEvidenceIds = modernCandidate
      ? [
          candidateItem.pos?.startsWith("n")
            ? "E-WORDNET-NOUN-3.0"
            : "E-WORDNET-ADJ-3.0",
          "E-WORDNET-LICENSE-3.0",
        ]
      : ["E-WORDNET-3.0"];
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
          ? wordNetEvidenceIds
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
    bookIds: modernCandidate
      ? action === "add"
        ? approvedBookIds
        : candidateItem.currentBookReferences.map((entry) => entry.bookId)
      : candidateItem.candidateBookScope,
    importance: action === "add" ? Math.max(1, 100 - word.senses.length * 3) : undefined,
    identityEvidenceStatus: candidateItem.identityEvidenceStatus ??
      "verified_target_locator_candidate_only",
    fields,
    expectedOldValueSha256,
    fieldEvidence,
  };
});

const sourceRelativePath = path.relative(rootDir, sourcePath).replaceAll(path.sep, "/");
if (modernCandidate && !approvedBatchId) {
  throw new Error("Modern candidate packages require --batch-id.");
}
if (modernCandidate && items.some((item) => item.action === "add") && !approvedBookIds.length) {
  throw new Error("Modern candidate packages with added senses require --book-ids.");
}
const generationEvidence = modernCandidate
  ? evidenceCatalog["E-CODEX-GENERATION"]
  : evidenceCatalog["E-CODEX-OP-FB-2026-08-13-B"];
const wordNetLicenseEvidence = modernCandidate
  ? evidenceCatalog["E-WORDNET-LICENSE-3.0"]
  : evidenceCatalog["E-WORDNET-3.0"];
const manifest = {
  schemaVersion: 2,
  batchId: approvedBatchId ?? candidate.batchId,
  purpose: "Apply the user-approved CD feedback batch without changing existing stable identities or deleting user data.",
  sourcePackage: {
    path: sourceRelativePath,
    sha256: candidateSha256,
    inputManifestSha256: candidate.inputManifestSha256,
    outputManifestSha256: candidate.outputManifestSha256,
  },
  baseline: candidateBaseline,
  review: {
    status: "approved",
    reviewerRole: "product owner",
    reviewedAt,
    scope: modernCandidate
      ? "all candidate fields, stable identities, both approved book references, and one display field that exactly reuses the approved definition text"
      : "all candidate fields, proposed stable sense IDs, and candidate book scopes",
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
    model: generationEvidence.model ?? candidate.model?.name,
    visibleVersion: generationEvidence.visibleVersion,
    weightsSource: generationEvidence.weightsSource,
    generationSession: generationEvidence.generationSession ?? candidate.model?.generationSession,
    prompt: generationEvidence.prompt,
    promptSha256Utf8: generationEvidence.promptSha256 ?? generationEvidence.promptSha256Utf8,
  },
  rights: {
    ...priorManifest.rights,
    wordnet: {
      author: wordNetLicenseEvidence.authorOrRightsholder ??
        wordNetLicenseEvidence.authorOrRightsHolder,
      license: wordNetLicenseEvidence.license ?? wordNetLicenseEvidence.licenseNameVersion,
      sourceUrl: priorManifest.rights.wordnet.sourceUrl,
      localEvidence: wordNetLicenseEvidence.asset ?? wordNetLicenseEvidence.licenseFile,
      localEvidenceSha256: wordNetLicenseEvidence.sha256 ?? wordNetLicenseEvidence.licenseSha256,
    },
    sourcePackage: sourceRelativePath,
    sourcePackageSha256: candidateSha256,
    residualRisk: `${priorManifest.rights.residualRisk} The exact model deployment snapshot remains undisclosed; the reviewed source package and field hashes preserve this batch's evidence.`,
  },
  counts: {
    approvedCandidateFields: candidate.fields.length,
    derivedImplementationFields: modernCandidate ? 1 : 0,
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
