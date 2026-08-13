import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const changeSetPath = path.join(
  rootDir,
  "data",
  "content-change-sets",
  "rd-multi-pronunciation-2026-08-12.json",
);
const ledgerPath = path.join(
  rootDir,
  "data",
  "content-change-sets",
  "rd-multi-pronunciation-2026-08-12-rights-ledger.json",
);
const shouldWriteLedger = process.argv.includes("--write-ledger");

const audioEvidenceFields = [
  "audioAuthor",
  "audioAuthorEvidenceBasis",
  "audioAuthorEvidenceUrl",
  "audioAuthorEvidenceAccessedAt",
  "audioAuthorEvidenceTextSha256",
  "audioLicense",
  "audioSourcePage",
  "audioMetadataSource",
  "audioMetadataRecord",
  "audioMetadataFetchedAt",
  "audioRightsEvidenceSha256",
];
const allowedFields = new Set([
  "audio",
  "audioAuthor",
  "audioAuthorEvidenceBasis",
  "audioAuthorEvidenceUrl",
  "audioAuthorEvidenceAccessedAt",
  "audioAuthorEvidenceTextSha256",
  "audioLicense",
  "audioLicenseUrl",
  "audioSourcePage",
  "audioAttribution",
  "audioMetadataSource",
  "audioMetadataRecord",
  "audioMetadataFetchedAt",
  "audioRightsEvidenceSha256",
  "ipa",
  "ipaSource",
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function valueSha256(value) {
  return sha256Bytes(JSON.stringify(value ?? null));
}

function normalizeIpa(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^\[|\]$/g, "")
    .trim();
}

function pronunciationIdentity(value) {
  let normalized = normalizeIpa(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ɹ", "r")
    .replaceAll("ɚ", "ər")
    .replaceAll("ɝ", "ɜr")
    .replace(/[.()\sː]/g, "");
  const vowelNuclei = normalized.match(/[aeiouyɑɐɒæəɘɜɞɛɤɪɨɔɵœøɶʊʉʌɯ]+/g) ?? [];
  if (vowelNuclei.length <= 1) normalized = normalized.replace(/[ˈˌ]/g, "");
  return normalized;
}

function validSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value ?? ""));
}

function targetSense(word, senseId) {
  return word?.senses?.find((sense) => sense.id === senseId);
}

function normalizedCommonsFilename(value) {
  return decodeURIComponent(String(value ?? ""))
    .replace(/^File:/i, "")
    .replaceAll("_", " ")
    .normalize("NFC")
    .toLocaleLowerCase("en-US");
}

function audioFilename(audioUrl) {
  const parsed = new URL(audioUrl);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const transcodedIndex = segments.indexOf("transcoded");
  return transcodedIndex >= 0 ? segments.at(-2) : segments.at(-1);
}

function sourceFilename(sourceUrl) {
  const parsed = new URL(sourceUrl);
  const marker = "/wiki/File:";
  const index = parsed.pathname.indexOf(marker);
  return index >= 0 ? parsed.pathname.slice(index + marker.length) : "";
}

function verifyAudioEvidence(item) {
  const fields = item.fields;
  for (const field of audioEvidenceFields) {
    assert(fields[field], `${item.itemId} is missing ${field}.`);
  }
  assert(
    validSha256(fields.audioAuthorEvidenceTextSha256),
    `${item.itemId} has an invalid author evidence hash.`,
  );
  assert(
    validSha256(fields.audioRightsEvidenceSha256),
    `${item.itemId} has an invalid audio rights evidence hash.`,
  );
  assert(
    fields.audioMetadataSource === "Wikimedia Commons API",
    `${item.itemId} does not use the approved metadata source.`,
  );
  const audioUrl = new URL(fields.audio);
  const sourceUrl = new URL(fields.audioSourcePage);
  assert(
    audioUrl.protocol === "https:" && audioUrl.hostname === "upload.wikimedia.org",
    `${item.itemId} audio is not a Wikimedia HTTPS asset.`,
  );
  assert(
    sourceUrl.protocol === "https:" && sourceUrl.hostname === "commons.wikimedia.org",
    `${item.itemId} source page is not Wikimedia Commons HTTPS.`,
  );
  assert(
    normalizedCommonsFilename(audioFilename(fields.audio))
      === normalizedCommonsFilename(sourceFilename(fields.audioSourcePage)),
    `${item.itemId} audio URL and source page identify different files.`,
  );
  assert(
    Number.isFinite(Date.parse(fields.audioMetadataFetchedAt)),
    `${item.itemId} has no valid metadata access time.`,
  );
  assert(
    Number.isFinite(Date.parse(fields.audioAuthorEvidenceAccessedAt)),
    `${item.itemId} has no valid author-evidence access time.`,
  );
}

function obligationsForLicense(license) {
  if (/CC BY-SA/i.test(license)) {
    return [
      "retain author and source attribution",
      "retain the applicable CC BY-SA license link",
      "apply ShareAlike when distributing an adapted recording",
    ];
  }
  if (/CC BY/i.test(license)) {
    return [
      "retain author and source attribution",
      "retain the applicable CC BY license link",
    ];
  }
  return ["retain the source and evidence record for provenance"];
}

const [bundleBytes, changeSetBytes] = await Promise.all([
  readFile(bundlePath),
  readFile(changeSetPath),
]);
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const changeSet = JSON.parse(changeSetBytes.toString("utf8"));
const words = new Map(bundle.words.map((word) => [word.id, word]));

assert(changeSet.batchId === "RD-MULTI-PRONUNCIATION-2026-08-12", "Unexpected batch ID.");
assert(changeSet.review?.status === "approved", "Pronunciation change set is not approved.");
assert(changeSet.targets?.length === 56, "The reviewed target list must contain 56 words.");
assert(changeSet.items?.length === 134, "The reviewed change set must contain 134 items.");
assert(
  changeSet.unresolvedPronunciations?.length === 2,
  "Only the two explicitly documented recording gaps may remain unresolved.",
);

const seenItemIds = new Set();
const seenSenseItems = new Set();
for (const item of changeSet.items) {
  assert(!seenItemIds.has(item.itemId), `Duplicate item ID: ${item.itemId}.`);
  seenItemIds.add(item.itemId);
  const senseKey = `${item.wordId}:${item.senseId}`;
  assert(!seenSenseItems.has(senseKey), `Duplicate sense update: ${senseKey}.`);
  seenSenseItems.add(senseKey);
  assert(item.action === "update", `${item.itemId} is not a non-destructive update.`);
  const word = words.get(item.wordId);
  const sense = targetSense(word, item.senseId);
  assert(sense, `${item.itemId} references an unknown stable word/sense ID.`);
  for (const field of Object.keys(item.fields ?? {})) {
    assert(allowedFields.has(field), `${item.itemId} changes unexpected field ${field}.`);
  }
  for (const [field, audit] of Object.entries(item.fieldAudit ?? {})) {
    assert(field in item.fields, `${item.itemId} audits absent field ${field}.`);
    assert(validSha256(audit.oldValueSha256), `${item.itemId}:${field} has no old hash.`);
    assert(validSha256(audit.newValueSha256), `${item.itemId}:${field} has no new hash.`);
    assert(
      audit.newValueSha256 === valueSha256(item.fields[field]),
      `${item.itemId}:${field} new hash does not match the value.`,
    );
    const currentHash = valueSha256(sense[field]);
    assert(
      currentHash === audit.oldValueSha256 || currentHash === audit.newValueSha256,
      `${item.itemId}:${field} drifted outside the reviewed old/new values.`,
    );
  }
  if (item.fields.audio) {
    assert(item.fieldAudit?.audio, `${item.itemId} audio has no before/after hashes.`);
    verifyAudioEvidence(item);
  }
}

const finalWords = structuredClone(bundle.words);
const finalById = new Map(finalWords.map((word) => [word.id, word]));
for (const item of changeSet.items) {
  Object.assign(targetSense(finalById.get(item.wordId), item.senseId), item.fields);
}

const unresolved = new Set(
  changeSet.unresolvedPronunciations.map((entry) => (
    `${entry.wordId}|${pronunciationIdentity(entry.ipa)}`
  )),
);
assert(
  unresolved.has(`decrease|${pronunciationIdentity("ˈdikris")}`)
    && unresolved.has(`insult|${pronunciationIdentity("ɪnˈsʌlt")}`),
  "The unresolved set does not match the two verified evidence gaps.",
);

let resolvedPronunciationCount = 0;
for (const target of changeSet.targets) {
  const word = finalById.get(target.wordId);
  assert(word, `Target word ${target.wordId} is missing.`);
  const groups = new Map();
  for (const sense of word.senses) {
    const ipa = normalizeIpa(sense.ipa);
    if (!ipa) continue;
    const identity = pronunciationIdentity(ipa);
    if (!groups.has(identity)) groups.set(identity, { ipas: new Set(), senses: [] });
    groups.get(identity).ipas.add(ipa);
    groups.get(identity).senses.push(sense);
  }
  assert(
    groups.size === target.pronunciationCount,
    `${target.wordId} pronunciation count drifted from the reviewed target.`,
  );
  const pronunciationByUrl = new Map();
  for (const [identity, group] of groups) {
    const senses = group.senses;
    const ipaLabel = [...group.ipas].join(" / ");
    const urls = new Set(senses.map((sense) => sense.audio).filter(Boolean));
    const key = `${target.wordId}|${identity}`;
    if (unresolved.has(key)) {
      assert(urls.size === 0, `${key} must remain empty until a verified recording exists.`);
      continue;
    }
    assert(urls.size === 1, `${key} must bind exactly one independent recording.`);
    const [url] = urls;
    assert(
      !pronunciationByUrl.has(url),
      `${target.wordId} reuses one recording for ${pronunciationByUrl.get(url)} and ${ipaLabel}.`,
    );
    pronunciationByUrl.set(url, ipaLabel);
    resolvedPronunciationCount += 1;
    const evidenceSense = senses.find((sense) => sense.audio === url);
    for (const field of ["audioAuthor", "audioLicense", "audioSourcePage", "audioRightsEvidenceSha256"]) {
      assert(evidenceSense[field], `${key} final recording is missing ${field}.`);
    }
  }
}

const manifestSha256 = sha256Bytes(changeSetBytes);
const rows = [];
for (const item of changeSet.items) {
  for (const [field, fieldAudit] of Object.entries(item.fieldAudit ?? {})) {
    const isAudio = field === "audio";
    const isIpa = field === "ipa";
    const fields = item.fields;
    rows.push({
      batchId: changeSet.batchId,
      itemId: item.itemId,
      assetId: `${item.wordId}:${item.senseId}:${field}`,
      wordId: item.wordId,
      senseId: item.senseId,
      field,
      purpose: isAudio
        ? "sense-bound pronunciation recording"
        : isIpa ? "reviewed lexical pronunciation" : "pronunciation provenance metadata",
      authorOrRightsholder: isAudio
        ? fields.audioAuthor
        : isIpa ? "Wiktionary contributors" : "Sense Vocab",
      directSource: isAudio
        ? fields.audioSourcePage
        : isIpa
          ? `https://en.wiktionary.org/wiki/${encodeURIComponent(item.wordId)}#English`
          : "data/content-change-sets/rd-multi-pronunciation-2026-08-12.json",
      acquiredAt: isAudio
        ? fields.audioMetadataFetchedAt
        : changeSet.review.reviewedAt,
      sourceVersionOrDate: isAudio
        ? fields.audioMetadataFetchedAt
        : changeSet.source.candidateIndexAccessedAt,
      license: isAudio
        ? fields.audioLicense
        : isIpa ? "CC BY-SA 4.0" : "Sense Vocab internal metadata",
      licenseUrl: isAudio
        ? fields.audioLicenseUrl ?? ""
        : isIpa ? "https://creativecommons.org/licenses/by-sa/4.0/" : "",
      scope: isAudio
        ? ["commercial use", "local caching", "public playback", "redistribution with the application"]
        : ["commercial use", "modification", "local caching", "public display", "redistribution with the application"],
      obligations: isAudio
        ? obligationsForLicense(fields.audioLicense)
        : isIpa
          ? ["retain source attribution", "retain the CC BY-SA 4.0 license link"]
          : ["retain the stable content ID and field audit hashes"],
      modification: "update",
      oldValueSha256: fieldAudit.oldValueSha256,
      newValueSha256: fieldAudit.newValueSha256,
      evidenceLocation: "data/content-change-sets/rd-multi-pronunciation-2026-08-12.json",
      evidenceSha256: isAudio ? fields.audioRightsEvidenceSha256 : manifestSha256,
      evidenceFields: isAudio ? audioEvidenceFields : undefined,
      processor: "R&D implementation",
      reviewerRole: changeSet.review.reviewerRole,
      reviewStatus: changeSet.review.status,
      residualRisk: "This row clears only the listed field in this maintenance change set; it is not global commercial-release clearance.",
      risk: "CLEARED",
    });
  }
}

const ledger = {
  schemaVersion: 1,
  batchId: changeSet.batchId,
  releaseScope: "ordinary maintenance change set",
  decision: "CLEARED",
  decisionScope: "Only the 138 applied audio, IPA, and IPA-source fields; unresolved recordings are excluded.",
  historicalGlobalCommercialGate: "BLOCKED outside this change set",
  reviewedAt: changeSet.review.reviewedAt,
  manifestSha256,
  rowCount: rows.length,
  resolvedPronunciationCount,
  unresolvedPronunciations: changeSet.unresolvedPronunciations.map((entry) => ({
    ...entry,
    status: "evidence_pending",
  })),
  rows,
};

assert(rows.length === 138, `Expected 138 field-level rights rows, found ${rows.length}.`);

if (shouldWriteLedger) {
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(rootDir, ledgerPath)}.`);
}

console.log(JSON.stringify({
  targetWords: changeSet.targets.length,
  resolvedPronunciations: resolvedPronunciationCount,
  unresolvedPronunciations: changeSet.unresolvedPronunciations.length,
  changedAudioFields: changeSet.items.filter((item) => item.fields.audio).length,
  fieldRightsRows: rows.length,
  manifestSha256,
}, null, 2));
