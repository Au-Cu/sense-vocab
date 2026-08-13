import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");
const manifestArgument = process.argv.find((argument) => argument.endsWith(".json"));
const manifestPath = manifestArgument
  ? path.resolve(rootDir, manifestArgument)
  : path.join(dataDir, "content-change-sets", "op-fb-2026-08-12-a.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const ledger = JSON.parse(await readFile(
  manifestPath.replace(/\.json$/i, "-rights-ledger.json"),
  "utf8",
));
const bundle = JSON.parse(await readFile(path.join(dataDir, "vocabulary-bundle.json"), "utf8"));

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fieldSha256 = (value) => sha256(JSON.stringify(value ?? null));
const failures = [];
const words = new Map(bundle.words.map((word) => [word.id, word]));

if (sha256(manifest.generation.prompt) !== manifest.generation.promptSha256Utf8) {
  failures.push("generation prompt hash mismatch");
}
if (sha256(manifest.rights.outputRightsEvidenceSummary) !==
  manifest.rights.outputRightsEvidenceSha256Utf8) {
  failures.push("OpenAI terms evidence hash mismatch");
}
if (manifest.sourcePackage) {
  const sourcePackage = await readFile(path.join(rootDir, manifest.sourcePackage.path));
  if (sha256(sourcePackage) !== manifest.sourcePackage.sha256) {
    failures.push("reviewed source package hash mismatch");
  }
}
for (const source of [manifest.rights.wordnet, manifest.rights.cmudict]) {
  const evidence = await readFile(path.join(rootDir, source.localEvidence));
  if (sha256(evidence) !== source.localEvidenceSha256) {
    failures.push(`license evidence hash mismatch: ${source.localEvidence}`);
  }
}
if (ledger.decision !== "CLEARED" || ledger.rowCount !== ledger.rows.length) {
  failures.push("change-set ledger is not cleared or complete");
}

for (const item of manifest.items) {
  const word = words.get(item.wordId);
  const sense = word?.senses.find((candidate) => candidate.id === item.senseId);
  if (!sense) {
    failures.push(`missing sense ${item.wordId}:${item.senseId}`);
    continue;
  }
  if (sense.generationBatchId !== manifest.batchId ||
    sense.humanReviewStatus !== "approved") {
    failures.push(`missing review metadata ${item.wordId}:${item.senseId}`);
  }
  for (const [field, value] of Object.entries(item.fields)) {
    if (JSON.stringify(sense[field]) !== JSON.stringify(value)) {
      failures.push(`field mismatch ${item.wordId}:${item.senseId}:${field}`);
    }
    const row = ledger.rows.find((candidate) =>
      candidate.assetId === `${item.wordId}:${item.senseId}:${field}`
    );
    if (!row || row.risk !== "CLEARED" || !row.authorOrRightsholder ||
      !row.directSource || !row.license || !row.evidenceLocation ||
      !row.evidenceSha256 ||
      row.newValueSha256 !== fieldSha256(value)) {
      failures.push(`rights record incomplete ${item.wordId}:${item.senseId}:${field}`);
    }
    const evidence = item.fieldEvidence?.[field];
    if (evidence?.candidateSha256Utf8 &&
      evidence.candidateSha256Utf8 !== sha256(String(value ?? "null"))) {
      failures.push(`candidate hash mismatch ${item.wordId}:${item.senseId}:${field}`);
    }
  }
  for (const bookId of item.bookIds ?? []) {
    const entry = bundle.books.find((book) => book.id === bookId)?.entries
      .find((candidate) => candidate.wordId === item.wordId);
    if (!entry?.senseIds.includes(item.senseId)) {
      failures.push(`missing book reference ${bookId}:${item.wordId}:${item.senseId}`);
    }
  }
}

for (const word of bundle.words) {
  const ids = word.senses.map((sense) => sense.id);
  if (new Set(ids).size !== ids.length) failures.push(`duplicate sense ID in ${word.id}`);
}

for (const item of manifest.noChangeItems) {
  if (!words.get(item.wordId)?.senses.some((sense) => sense.id === item.senseId)) {
    failures.push(`missing no-change target ${item.wordId}:${item.senseId}`);
  }
}

if (failures.length) {
  console.error("Content change-set gate: BLOCKED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(
  `Content change-set gate: CLEARED (${manifest.items.length} items, ${ledger.rowCount} fields).`,
);
