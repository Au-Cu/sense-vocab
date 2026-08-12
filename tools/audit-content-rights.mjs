import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const reportPath = path.join(rootDir, "data", "content-rights-audit.json");
const summaryPath = path.join(rootDir, "data", "content-rights-summary.json");
const strict = process.argv.includes("--strict");

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

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const findings = {
  remoteAudioWithoutCompleteAttribution: [],
  quotationExamplesRequiringReview: [],
  tatoebaExamplesWithoutCompleteAttribution: [],
  tatoebaExamplesWithMetadataMismatch: [],
  semanticExamplesWithoutTraceableAttribution: [],
  translationSourcesRequiringCommercialReview: [],
  legacyExternalServicesRequiringReplacement: [
    {
      service: "https://dict.youdao.com/dictvoice",
      use: "runtime pronunciation fallback",
      status: "temporarily retained for free-beta feature compatibility",
    },
    {
      service: "https://translate.googleapis.com/translate_a/single",
      use: "zh-to-en maintenance translation only",
      status:
        "temporarily retained where the licensed local model does not support the direction",
    },
  ],
};

function ref(word, sense) {
  return {
    wordId: word.id,
    word: word.word,
    senseId: sense.id,
    source: sense.exampleSource ?? null,
  };
}

for (const word of bundle.words) {
  for (const sense of word.senses) {
    if (
      sense.audio &&
      !(
        sense.audioAuthor &&
        sense.audioLicense &&
        sense.audioSourcePage &&
        sense.audioMetadataRecord &&
        sense.audioRightsEvidenceSha256
      )
    ) {
      findings.remoteAudioWithoutCompleteAttribution.push(ref(word, sense));
    }

    const exampleSource = String(sense.exampleSource ?? "").toLowerCase();
    if (exampleSource.includes("quotation")) {
      findings.quotationExamplesRequiringReview.push(ref(word, sense));
    }
    if (
      exampleSource === "tatoeba" &&
      !(
        sense.exampleSourceId &&
        sense.exampleLicense &&
        (sense.exampleOwner || sense.exampleOwnerStatus === "unowned") &&
        sense.exampleSourcePage &&
        sense.exampleMetadataRecord &&
        sense.exampleRightsEvidenceSha256 &&
        sense.exampleMetadataStatus === "verified"
      )
    ) {
      findings.tatoebaExamplesWithoutCompleteAttribution.push(ref(word, sense));
    }
    if (
      exampleSource === "tatoeba" &&
      sense.exampleMetadataStatus === "text-mismatch"
    ) {
      findings.tatoebaExamplesWithMetadataMismatch.push(ref(word, sense));
    }
    if (
      exampleSource.startsWith("semantic-") &&
      !(sense.exampleSourceId && sense.exampleLicense)
    ) {
      findings.semanticExamplesWithoutTraceableAttribution.push(ref(word, sense));
    }

    for (const [field, value] of Object.entries(sense)) {
      if (
        /source/i.test(field) &&
        /google|translate\.google/i.test(String(value ?? ""))
      ) {
        findings.translationSourcesRequiringCommercialReview.push({
          ...ref(word, sense),
          field,
          value,
        });
      }
    }
  }
}

const counts = Object.fromEntries(
  Object.entries(findings).map(([key, items]) => [key, items.length]),
);
const report = {
  generatedAt: new Date().toISOString(),
  bundleSchemaVersion: bundle.schemaVersion,
  counts,
  releasePolicy: {
    remoteAudio:
      "The free beta retains existing Wikimedia audio to avoid feature loss. Missing per-file rights metadata remains blocking for paid release.",
    translation:
      "English-to-Chinese maintenance translation uses the local CC BY 4.0 Argos/OPUS model. The historical unofficial endpoint remains only for unsupported Chinese-to-English maintenance work.",
    unresolvedText:
      "Existing text stays unchanged for learning-record compatibility. Items in this report require licensing or independent rewriting before paid commercial release.",
  },
  findings,
};

await writeFileWithRetry(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFileWithRetry(
  summaryPath,
  `${JSON.stringify({
    generatedAt: report.generatedAt,
    bundleSchemaVersion: report.bundleSchemaVersion,
    counts,
    releasePolicy: report.releasePolicy,
  }, null, 2)}\n`,
);
console.log("Content-rights audit:");
for (const [key, count] of Object.entries(counts)) {
  console.log(`- ${key}: ${count}`);
}
console.log(`Report written to ${reportPath}`);
console.log(`Public summary written to ${summaryPath}`);

if (strict && Object.values(counts).some((count) => count > 0)) {
  console.error("Strict content-rights audit failed.");
  process.exit(1);
}
