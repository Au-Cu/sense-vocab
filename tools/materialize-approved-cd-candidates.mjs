import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stringHash(value) {
  return sha256(String(value ?? "null"));
}

function jsonHash(value) {
  return sha256(JSON.stringify(value ?? null));
}

function prefixForPos(pos) {
  if (String(pos).startsWith("adj")) return "adj";
  if (String(pos).startsWith("adv")) return "adv";
  const prefix = String(pos).trim().charAt(0);
  if (!/[a-z]/i.test(prefix)) throw new Error(`Unsupported candidate POS: ${pos}`);
  return prefix.toLowerCase();
}

function extractSenseId(locator, wordId) {
  if (!locator) return null;
  const escapedWordId = wordId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(locator).match(new RegExp(`#${escapedWordId}:([^.:]+)\\.`))?.[1] ?? null;
}

function nextSenseId(word, pos, allocatedIds) {
  const prefix = prefixForPos(pos);
  const ids = [
    ...word.senses.map((sense) => sense.id),
    ...allocatedIds,
  ];
  const highest = ids.reduce((max, id) => {
    const match = String(id).match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${highest + 1}`;
}

function requireEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const candidatePath = path.resolve(arg("--candidate"));
const batchId = arg("--batch-id");
const reviewedAt = arg("--reviewed-at", "2026-08-23");
const bookIds = (arg("--book-ids", "kaoyan") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (!candidatePath || !batchId || !bookIds.length) {
  throw new Error("Usage: node tools/materialize-approved-cd-candidates.mjs --candidate <file> --batch-id <id> [--book-ids kaoyan] [--reviewed-at YYYY-MM-DD]");
}

const outputBase = path.join(dataDir, "content-change-sets", batchId);
const manifestPath = `${outputBase}.json`;
const sourcePath = `${outputBase}-source.json`;
const priorManifestPath = path.join(dataDir, "content-change-sets", "op-fb-2026-08-14.json");
const bundlePath = path.join(dataDir, "vocabulary-bundle.json");
const lockPath = path.join(dataDir, "content-identity-lock.json");

const [candidateBytes, bundleBytes, lockBytes, priorManifestBytes] = await Promise.all([
  readFile(candidatePath),
  readFile(bundlePath),
  readFile(lockPath),
  readFile(priorManifestPath),
]);
const candidateSha256 = sha256(candidateBytes);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const lock = JSON.parse(lockBytes.toString("utf8"));
const priorManifest = JSON.parse(priorManifestBytes.toString("utf8"));
const sourceBatchId = arg("--source-batch-id", candidate.batchId);

requireEqual(candidate.batchId, sourceBatchId, "Candidate source batch ID mismatch");
requireEqual(candidate.baseline?.bundleSha256, sha256(bundleBytes), "Candidate vocabulary baseline mismatch");
requireEqual(candidate.baseline?.identityLockSha256, sha256(lockBytes), "Candidate identity baseline mismatch");
requireEqual(candidate.baseline?.packageVersion, "1.7.1", "Candidate package version mismatch");
requireEqual(candidate.promptSha256, sha256(candidate.prompt), "Candidate prompt hash mismatch");
if (candidate.counts?.evidence_pending !== 12) {
  throw new Error(`Expected 12 evidence-pending items, got ${candidate.counts?.evidence_pending}`);
}

const words = new Map(bundle.words.map((word) => [word.id, word]));
const newIdsByWord = new Map();
const implementationItems = [];
const resolvedNoChangeItems = [];
const excludedNoChangeItems = [];

for (const candidateItem of candidate.items ?? []) {
  const word = words.get(candidateItem.wordId);
  if (!word) throw new Error(`Unknown candidate wordId: ${candidateItem.wordId}`);

  if (candidateItem.status === "evidence_pending") continue;
  if (candidateItem.status === "no_change") {
    const directSense = candidateItem.senseId
      ? word.senses.find((sense) => sense.id === candidateItem.senseId)
      : null;
    const synsetSense = candidateItem.synsetId
      ? word.senses.find((sense) => sense.synsetId === candidateItem.synsetId)
      : null;
    const sense = directSense ?? synsetSense;
    if (sense) {
      resolvedNoChangeItems.push({
        itemId: candidateItem.batchItemId,
        wordId: candidateItem.wordId,
        senseId: sense.id,
        bookIds,
        reason: candidateItem.reason,
      });
    } else {
      excludedNoChangeItems.push({
        itemId: candidateItem.batchItemId,
        wordId: candidateItem.wordId,
        reason: candidateItem.reason,
      });
    }
    continue;
  }
  if (candidateItem.status !== "candidate") {
    throw new Error(`Unexpected candidate status: ${candidateItem.status}`);
  }

  const locatorHint = (candidateItem.fields ?? [])
    .map((field) => extractSenseId(field.oldValueLocator, candidateItem.wordId))
    .find(Boolean) ?? null;
  const hintedSense = word.senses.find((sense) =>
    sense.id === (candidateItem.senseId ?? locatorHint) ||
    sense.synsetId === candidateItem.synsetId,
  );
  const groups = new Map();
  for (const field of candidateItem.fields ?? []) {
    const synsetId = field.synsetId ?? candidateItem.synsetId;
    const pos = field.pos ?? candidateItem.pos ??
      word.senses.find((sense) => sense.synsetId === synsetId)?.pos ??
      hintedSense?.pos;
    if (!synsetId || !pos) throw new Error(`Missing synset/POS for ${candidateItem.batchItemId}:${field.field}`);
    const key = `${synsetId}|${pos}`;
    const group = groups.get(key) ?? { synsetId, pos, fields: [] };
    group.fields.push(field);
    groups.set(key, group);
  }
  if (!groups.size) throw new Error(`Candidate has no fields: ${candidateItem.batchItemId}`);

  let groupIndex = 0;
  for (const group of groups.values()) {
    const locatorSenseId = group.fields
      .map((field) => extractSenseId(field.oldValueLocator, candidateItem.wordId))
      .find(Boolean) ?? null;
    const directSense = candidateItem.senseId
      ? word.senses.find((sense) => sense.id === candidateItem.senseId)
      : null;
    const locatedSense = locatorSenseId
      ? word.senses.find((sense) => sense.id === locatorSenseId)
      : null;
    const synsetSense = word.senses.find((sense) => sense.synsetId === group.synsetId);
    const existingSense = directSense ?? locatedSense ?? synsetSense;
    const isUpdate = Boolean(existingSense);
    const allocatedIds = newIdsByWord.get(word.id) ?? [];
    const senseId = existingSense?.id ?? nextSenseId(word, group.pos, allocatedIds);
    if (!existingSense) {
      allocatedIds.push(senseId);
      newIdsByWord.set(word.id, allocatedIds);
    }

    const fields = {};
    const expectedOldValueSha256 = {};
    const fieldEvidence = {};
    for (const field of group.fields) {
      if (Object.hasOwn(fields, field.field)) {
        throw new Error(`Duplicate candidate field: ${candidateItem.batchItemId}:${field.field}`);
      }
      if (stringHash(field.candidateValue) !== field.candidateSha256Utf8) {
        throw new Error(`Candidate value hash mismatch: ${candidateItem.batchItemId}:${field.field}`);
      }
      const currentValue = existingSense?.[field.field] ?? null;
      const expectedOldHash = field.oldValueSha256 ?? stringHash(null);
      if (isUpdate) requireEqual(
        stringHash(currentValue),
        expectedOldHash,
        `Runtime old value changed for ${candidateItem.batchItemId}:${field.field}`,
      );
      if (!isUpdate && field.oldValueSha256 !== null) {
        throw new Error(`New candidate unexpectedly has an old value: ${candidateItem.batchItemId}:${field.field}`);
      }
      fields[field.field] = field.candidateValue;
      expectedOldValueSha256[field.field] = jsonHash(currentValue);
      fieldEvidence[field.field] = {
        origin: "independent_ai_assisted_candidate",
        candidateSha256Utf8: field.candidateSha256Utf8,
        oldValueSha256: expectedOldHash,
        sourceIds: [
          ...(field.inputEvidenceRef ?? []),
          field.rightsEvidenceRef,
        ].filter(Boolean),
        license: "OpenAI output under the recorded project terms; WordNet 3.0 used only for semantic identity/gloss evidence",
      };
    }

    if (!isUpdate) {
      fields.pos = group.pos;
      fields.synsetId = group.synsetId;
      expectedOldValueSha256.pos = jsonHash(null);
      expectedOldValueSha256.synsetId = jsonHash(null);
      for (const [field, value] of [["pos", group.pos], ["synsetId", group.synsetId]]) {
        fieldEvidence[field] = {
          origin: "wordnet_3_0_semantic_identity",
          candidateSha256Utf8: stringHash(value),
          oldValueSha256: stringHash(null),
          sourceIds: ["rights-wordnet-3.0-local", ...(group.fields[0].inputEvidenceRef ?? [])],
          license: "WordNet Release 3.0 License",
        };
      }
      word.senses.push({ id: senseId, pos: group.pos, synsetId: group.synsetId });
    }

    implementationItems.push({
      itemId: groups.size === 1 ? candidateItem.batchItemId : `${candidateItem.batchItemId}:${groupIndex + 1}`,
      sourceBatchItemId: candidateItem.batchItemId,
      wordId: candidateItem.wordId,
      senseId,
      action: isUpdate ? "update" : "add",
      bookIds,
      importance: isUpdate ? undefined : Math.max(1, 100 - word.senses.length * 3),
      identityEvidenceStatus: isUpdate
        ? "verified_existing_sense_by_wordId_senseId_or_synset"
        : "verified_new_sense_by_wordId_synset_pos; allocated_next_unused_pos_namespace_id",
      fields,
      expectedOldValueSha256,
      fieldEvidence,
      identityResolution: isUpdate ? null : {
        stableKey: `${candidateItem.wordId}:${group.synsetId}`,
        allocatedSenseId: senseId,
        rule: "next unused ID in the existing POS namespace; existing IDs and order are untouched",
        sourceBatchItemId: candidateItem.batchItemId,
      },
    });
    groupIndex += 1;
  }
}

const sourceRelativePath = `data/content-change-sets/${path.basename(sourcePath)}`;
const rights = {
  ...priorManifest.rights,
  sourcePackage: sourceRelativePath,
  sourcePackageSha256: candidateSha256,
  residualRisk: `${priorManifest.rights.residualRisk} This batch uses the candidate package generated on ${candidate.model?.generationDate}; the exact model deployment snapshot remains undisclosed.`,
};
const manifest = {
  schemaVersion: 2,
  batchId,
  purpose: "Apply the explicitly user-approved CD feedback candidates with stable identity preservation.",
  sourcePackage: {
    path: sourceRelativePath,
    sha256: candidateSha256,
    candidatePath: "external review artifact; not a formal workspace path",
  },
  baseline: candidate.baseline,
  review: {
    status: "approved",
    reviewerRole: "product owner",
    reviewedAt,
    scope: "all candidate items and fields with complete evidence; evidence_pending items remain excluded",
  },
  compatibility: {
    strategy: "explicit-new-sense-initialization",
    addedSenseKeys: implementationItems
      .filter((item) => item.action === "add")
      .map((item) => `${item.wordId}:${item.senseId}`),
    identityResolution: implementationItems
      .filter((item) => item.identityResolution)
      .map((item) => item.identityResolution),
    behavior: "Existing sense state is retained; newly introduced senses are explicitly referenced only by kaoyan and initialize as selectable new content through the existing content pipeline.",
  },
  generation: {
    supplier: candidate.model?.supplier,
    model: candidate.model?.model,
    visibleVersion: candidate.model?.generationDate,
    weightsSource: candidate.model?.weightsSource,
    generationSession: sourceBatchId,
    prompt: candidate.prompt,
    promptSha256Utf8: candidate.promptSha256,
  },
  rights,
  counts: {
    candidateItems: candidate.counts.candidate,
    candidateFields: (candidate.items ?? [])
      .filter((item) => item.status === "candidate")
      .reduce((count, item) => count + item.fields.length, 0),
    implementationItems: implementationItems.length,
    approvedCandidateFields: implementationItems.reduce((count, item) => count + Object.keys(item.fields).length, 0),
    identityFields: implementationItems
      .filter((item) => item.action === "add")
      .reduce((count) => count + 2, 0),
    noChangeItems: resolvedNoChangeItems.length,
    excludedNoChangeItems: excludedNoChangeItems.length,
    pendingItems: (candidate.items ?? [])
      .filter((item) => item.status === "evidence_pending")
      .map((item) => ({
        itemId: item.batchItemId,
        wordId: item.wordId,
        reason: item.reason,
      })),
  },
  items: implementationItems,
  noChangeItems: resolvedNoChangeItems,
  excludedNoChangeItems,
};

await Promise.all([
  writeFile(sourcePath, candidateBytes),
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  batchId,
  candidateItems: manifest.counts.candidateItems,
  candidateFields: manifest.counts.candidateFields,
  implementationItems: manifest.counts.implementationItems,
  approvedCandidateFields: manifest.counts.approvedCandidateFields,
  addedSenses: manifest.compatibility.addedSenseKeys.length,
  noChangeItems: manifest.counts.noChangeItems,
  pendingItems: manifest.counts.pendingItems.length,
}, null, 2));
