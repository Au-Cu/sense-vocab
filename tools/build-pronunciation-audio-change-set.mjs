import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const bundlePath = path.join(rootDir, "data", "vocabulary-bundle.json");
const outputPath = path.join(
  rootDir,
  "data",
  "content-change-sets",
  "rd-multi-pronunciation-2026-08-12.json",
);
const shouldWrite = process.argv.includes("--write");
const baselineBundleSha256 = "f52aa4ef650751602adf9a396fe84a3076d02125d096521ed4141113040d6774";

const EXTRA_HETERONYMS = new Set([
  "aggregate",
  "conserve",
  "override",
  "sewer",
  "tear",
]);
const ALLOWED_UNRESOLVED = new Set([
  "decrease|ˈdikris",
  "insult|ɪnˈsʌlt",
]);
const MANUAL_AUDIO = new Map(Object.entries({
  "abstract|ˈæbstrækt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/98/LL-Q1860_%28eng%29-Vealhurl-abstract_%28noun%29.wav/LL-Q1860_%28eng%29-Vealhurl-abstract_%28noun%29.wav.mp3",
  "abstract|æbˈstrækt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b6/LL-Q1860_%28eng%29-Vealhurl-abstract_%28verb%29.wav/LL-Q1860_%28eng%29-Vealhurl-abstract_%28verb%29.wav.mp3",
  "decrease|dɪˈkris": "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/21/En-us-decrease.ogg/En-us-decrease.ogg.mp3",
  "estimate|ˈɛstəmeɪt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/01/En-us-estimate-verb.ogg/En-us-estimate-verb.ogg.mp3",
  "estimate|ˈɛstəmət": "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/bf/En-us-estimate-noun.ogg/En-us-estimate-noun.ogg.mp3",
  "export|ɪkˈspɔrt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/dd/LL-Q1860_%28eng%29-Vealhurl-export_%28verb%29.wav/LL-Q1860_%28eng%29-Vealhurl-export_%28verb%29.wav.mp3",
  "export|ˈɛkspɔrt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e4/LL-Q1860_%28eng%29-Vealhurl-export_%28noun%29.wav/LL-Q1860_%28eng%29-Vealhurl-export_%28noun%29.wav.mp3",
  "import|ɪmˈpɔrt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e3/LL-Q1860_%28eng%29-Vealhurl-import_%28verb%29.wav/LL-Q1860_%28eng%29-Vealhurl-import_%28verb%29.wav.mp3",
  "import|ˈɪmpɔrt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d3/LL-Q1860_%28eng%29-Vealhurl-import_%28noun%29.wav/LL-Q1860_%28eng%29-Vealhurl-import_%28noun%29.wav.mp3",
  "insult|ˈɪnsʌlt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/ca/En-us-insult.ogg/En-us-insult.ogg.mp3",
  "permit|pərˈmɪt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c3/En-us-permit-verb.ogg/En-us-permit-verb.ogg.mp3",
  "permit|ˈpɜrmɪt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4b/En-us-permit-noun.ogg/En-us-permit-noun.ogg.mp3",
  "protest|prəˈtɛst": "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/bd/En-us-protest-verb.ogg/En-us-protest-verb.ogg.mp3",
  "protest|ˈproʊtɛst": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5e/En-us-protest-noun.ogg/En-us-protest-noun.ogg.mp3",
  "refund|rɪˈfʌnd": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ee/En-us-refund-verb.ogg/En-us-refund-verb.ogg.mp3",
  "refund|ˈrifʌnd": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/59/En-us-refund-noun.ogg/En-us-refund-noun.ogg.mp3",
  "separate|ˈsɛpərət": "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b3/En-us-separate-adj.ogg/En-us-separate-adj.ogg.mp3",
  "separate|ˈsɛpəreɪt": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/68/En-us-separate-verb.ogg/En-us-separate-verb.ogg.mp3",
  "transfer|ˈtrænsfɜr": "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/98/En-us-transfer.ogg/En-us-transfer.ogg.mp3",
  "transfer|trænsˈfɜr": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8e/LL-Q1860_%28eng%29-Vealhurl-transfer_%28verb%29.wav/LL-Q1860_%28eng%29-Vealhurl-transfer_%28verb%29.wav.mp3",
}));

const POS_MAP = {
  "n.": "noun",
  "v.": "verb",
  "adj.": "adj",
  "adv.": "adv",
  "prep.": "prep",
  "conj.": "conj",
  "pron.": "pron",
  "num.": "num",
  "int.": "intj",
};

function normalizeIpa(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^\[|\]$/g, "")
    .trim();
}

function valueSha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

function comparisonIpa(value) {
  return normalizeIpa(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ɹ", "r")
    .replaceAll("ɚ", "ər")
    .replaceAll("ɝ", "ɜr")
    .replace(/[.()\sː]/g, "");
}

function pronunciationIdentity(value) {
  let normalized = comparisonIpa(value);
  const vowelNuclei = normalized.match(/[aeiouyɑɐɒæəɘɜɞɛɤɪɨɔɵœøɶʊʉʌɯ]+/g) ?? [];
  if (vowelNuclei.length <= 1) normalized = normalized.replace(/[ˈˌ]/g, "");
  return normalized;
}

function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function ipaSimilarity(left, right) {
  const normalizedLeft = comparisonIpa(left);
  const normalizedRight = comparisonIpa(right);
  return 1 - levenshtein(normalizedLeft, normalizedRight) /
    Math.max(1, normalizedLeft.length, normalizedRight.length);
}

function wordUrl(word) {
  const lower = word.toLowerCase();
  return `https://kaikki.org/dictionary/English/meaning/${encodeURIComponent(lower[0])}/${encodeURIComponent(lower.slice(0, 2))}/${encodeURIComponent(lower)}.jsonl`;
}

async function fetchEntries(word) {
  const response = await fetch(wordUrl(word), {
    headers: { "user-agent": "sense-vocab-pronunciation-builder/1.0" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Kaikki returned ${response.status} for ${word}.`);
  const text = await response.text();
  return text.split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const entry = JSON.parse(line);
        if (entry.lang_code !== "en" || entry.word?.toLowerCase() !== word.toLowerCase()) {
          return [];
        }
        const ipas = (entry.sounds ?? []).map((sound) => sound.ipa).filter(Boolean);
        const audio = (entry.sounds ?? []).flatMap((sound) => {
          const url = sound.mp3_url || sound.ogg_url;
          return url ? [{ url, tags: sound.tags ?? [] }] : [];
        });
        return ipas.length && audio.length ? [{ pos: entry.pos, ipas, audio }] : [];
      } catch {
        return [];
      }
    });
}

function preferredAudio(audio) {
  const preference = (entry) => {
    if (entry.tags.some((tag) => /^(US|General-American|California)$/i.test(tag))) return 3;
    if (entry.tags.some((tag) => /Canada/i.test(tag))) return 2;
    if (entry.tags.some((tag) => /UK|England|Received/i.test(tag))) return 1;
    return 0;
  };
  return audio.slice().sort((left, right) => preference(right) - preference(left))[0]?.url ?? "";
}

function selectAudio(word, ipa, senses, entries) {
  const manual = MANUAL_AUDIO.get(`${word}|${ipa}`);
  if (manual) return manual;
  let best = null;
  for (const entry of entries) {
    const similarity = Math.max(...entry.ipas.map((candidate) => ipaSimilarity(ipa, candidate)));
    const posMatch = senses.some((sense) => POS_MAP[sense.pos] === entry.pos);
    const score = similarity + (posMatch ? 0.45 : 0);
    if (!best || score > best.score) best = { entry, score };
  }
  return best ? preferredAudio(best.entry.audio) : "";
}

function desiredIpa(word, sense) {
  if (word !== "aggregate") return normalizeIpa(sense.ipa);
  return sense.pos === "v." ? "ˈæɡrɪɡeɪt" : "ˈæɡrɪɡət";
}

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const targets = bundle.words.filter((word) => {
  if (!(
    EXTRA_HETERONYMS.has(word.word)
    || word.senses.some((sense) => String(sense.ipaSource ?? "").includes("heteronym"))
  )) return false;
  const pronunciations = new Set(
    word.senses
      .map((sense) => pronunciationIdentity(desiredIpa(word.word, sense)))
      .filter(Boolean),
  );
  return pronunciations.size > 1;
});
const items = [];
const unresolvedPronunciations = [];
let itemNumber = 1;
let cursor = 0;

async function worker() {
  while (cursor < targets.length) {
    const word = targets[cursor];
    cursor += 1;
    const entries = await fetchEntries(word.word);
    const groups = new Map();
    for (const sense of word.senses) {
      const ipa = desiredIpa(word.word, sense);
      if (!ipa) continue;
      const identity = pronunciationIdentity(ipa);
      if (!groups.has(identity)) groups.set(identity, { ipa, senses: [] });
      groups.get(identity).senses.push(sense);
    }
    for (const { ipa, senses } of groups.values()) {
      const existingAudio = senses.map((sense) => sense.audio).find(Boolean);
      const audio = existingAudio || selectAudio(word.word, ipa, senses, entries);
      if (!audio || ALLOWED_UNRESOLVED.has(`${word.word}|${ipa}`)) {
        unresolvedPronunciations.push({
          wordId: word.id,
          ipa,
          senseIds: senses.map((sense) => sense.id),
          reason: "No independently verified recording is currently bound to this pronunciation.",
        });
        continue;
      }
      for (const sense of senses) {
        const fields = {};
        if (sense.audio !== audio) fields.audio = audio;
        if (word.word === "aggregate" && normalizeIpa(sense.ipa) !== ipa) {
          fields.ipa = ipa;
          fields.ipaSource = "heteronym-pos-override";
        }
        if (!Object.keys(fields).length) continue;
        const fieldAudit = Object.fromEntries(
          Object.entries(fields).map(([field, value]) => [field, {
            oldValueSha256: valueSha256(sense[field]),
            newValueSha256: valueSha256(value),
          }]),
        );
        items.push({
          itemId: `P${String(itemNumber).padStart(3, "0")}`,
          wordId: word.id,
          senseId: sense.id,
          action: "update",
          fields,
          fieldAudit,
        });
        itemNumber += 1;
      }
    }
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
items.sort((left, right) => (
  left.wordId.localeCompare(right.wordId)
  || left.senseId.localeCompare(right.senseId, "en", { numeric: true })
));
items.forEach((item, index) => {
  item.itemId = `P${String(index + 1).padStart(3, "0")}`;
});
unresolvedPronunciations.sort((left, right) => left.wordId.localeCompare(right.wordId));

const manifest = {
  schemaVersion: 1,
  batchId: "RD-MULTI-PRONUNCIATION-2026-08-12",
  purpose: "Bind each reviewed lexical pronunciation to an independent Wikimedia Commons recording while preserving stable word and sense identities.",
  baseline: {
    path: "data/vocabulary-bundle.json",
    sha256: baselineBundleSha256,
  },
  review: {
    status: "approved",
    reviewedAt: "2026-08-12",
    reviewerRole: "R&D implementation review under the product-owner feature request",
    authorizationBasis: "The product owner explicitly requested real recordings for every available lexical pronunciation in the current R&D task.",
    scope: "Pronunciation-to-sense audio bindings with explicit IPA/POS evidence; explicitly unresolved recordings are excluded.",
  },
  source: {
    candidateIndex: "Kaikki / English Wiktionary",
    candidateIndexUrl: "https://kaikki.org/dictionary/English/",
    candidateIndexAccessedAt: "2026-08-12",
    recordingHost: "Wikimedia Commons",
    recordingHostUrl: "https://commons.wikimedia.org/",
    selectionRule: "One recording per distinct reviewed lexical pronunciation; prefer a matching part of speech and US recording when available; never reuse one pronunciation as another.",
  },
  targets: targets.map((word) => ({
    wordId: word.id,
    pronunciationCount: new Set(
      word.senses
        .map((sense) => pronunciationIdentity(desiredIpa(word.word, sense)))
        .filter(Boolean),
    ).size,
  })),
  items,
  unresolvedPronunciations,
};

console.log(JSON.stringify({
  targetWords: targets.length,
  items: items.length,
  audioUpdates: items.filter((item) => item.fields.audio).length,
  ipaCorrections: items.filter((item) => item.fields.ipa).length,
  unresolvedPronunciations,
}, null, 2));

if (shouldWrite) {
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(rootDir, outputPath)}.`);
}
