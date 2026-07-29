import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "for",
  "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
  "that", "the", "their", "this", "to", "was", "were", "which", "while",
  "with", "without", "someone", "something",
]);
const DEFINITIONAL_RE = /\b(?:means|is defined as|refers to|in this sense|is used with the meaning)\b/i;
const PLACEHOLDER_RE = /\b(?:helpful sentence|needs clue words|generic sentence|points to a specific meaning|the investigation focused on)\b/i;
const EXCLUDED_TAGS = new Set([
  "alt-of", "alternative", "archaic", "dated", "dialectal", "historical",
  "misspelling", "nonstandard", "obsolete", "offensive", "rare", "slang",
]);
let morphologyByWord = new Map();

function tokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function lexicalScore(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });
  return overlap / Math.sqrt(a.size * b.size);
}

function cleanSentence(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const capitalized = text[0].toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function wordForms(word) {
  const base = String(word ?? "").toLowerCase();
  const forms = new Set([base]);
  const morphology = morphologyByWord.get(base) ?? {};
  for (const section of Object.values(morphology)) {
    if (!section || typeof section !== "object") continue;
    for (const value of Object.values(section)) {
      if (!Array.isArray(value)) continue;
      value.forEach((entry) => {
        if (entry?.form) forms.add(String(entry.form).toLowerCase());
      });
    }
  }
  if (/^[a-z]+$/.test(base)) {
    forms.add(`${base}s`);
    forms.add(`${base}es`);
    forms.add(`${base}ed`);
    forms.add(`${base}ing`);
    if (base.endsWith("y")) {
      forms.add(`${base.slice(0, -1)}ies`);
      forms.add(`${base.slice(0, -1)}ied`);
    }
    if (base.endsWith("e")) forms.add(`${base.slice(0, -1)}ing`);
  }
  return [...forms].sort((left, right) => right.length - left.length);
}

function containsForm(sentence, forms) {
  const text = String(sentence ?? "").toLowerCase();
  return forms.some((form) => (
    new RegExp(`(^|[^a-z])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`)
      .test(text)
  ));
}

function sentenceScore(word, sense, sentence, source) {
  const text = cleanSentence(sentence);
  if (!text || DEFINITIONAL_RE.test(text) || PLACEHOLDER_RE.test(text)) return -Infinity;
  const forms = wordForms(word);
  if (!containsForm(text, forms)) return -Infinity;
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 4 || wordCount > 34) return -Infinity;
  const clueOverlap = lexicalScore(
    [sense.definition, sense.definitionSentence].join(" "),
    text,
  );
  let score = 80 + Math.min(35, clueOverlap * 90);
  score += Math.max(0, 18 - Math.abs(13 - wordCount) * 1.5);
  if (source === "tatoeba") score += 22;
  if (source === "kaikki") score += 18;
  if (source === "dictionary" || source === "wordnet-example") score += 12;
  if (/[?]$/.test(text)) score -= 12;
  if (/^(?:this|that|it)\s+(?:is|was)\b/i.test(text)) score -= 18;
  if (/\b(?:tom|mary|john|jack)\b/i.test(text)) score -= 12;
  if (/;/.test(text) && wordCount < 8) score -= 12;
  return score;
}

function flattenedKaikki(cacheEntry, pos = "") {
  const result = [];
  for (const entry of cacheEntry?.entries ?? []) {
    if (pos && entry.pos !== pos) continue;
    for (const [senseIndex, sense] of (entry.senses ?? []).entries()) {
      if ((sense.tags ?? []).some((tag) => EXCLUDED_TAGS.has(String(tag).toLowerCase()))) {
        continue;
      }
      const definition = sense.glosses.at(-1) ?? sense.glosses[0] ?? "";
      if (!definition) continue;
      result.push({
        entry,
        sense,
        senseIndex,
        definition,
      });
    }
  }
  return result;
}

function rankedKaikkiMatches(cacheEntry, sense) {
  return flattenedKaikki(cacheEntry, sense.pos)
    .map((candidate) => ({
      ...candidate,
      matchScore: lexicalScore(sense.definition, candidate.definition),
    }))
    .sort((left, right) => right.matchScore - left.matchScore);
}

function simplifiedTranslation(sentence) {
  return (sentence.translations ?? [])
    .filter((item) => item.lang === "cmn" && item.script === "Hans" && item.text)
    .sort((left, right) => (
      Number(Boolean(right.is_direct)) - Number(Boolean(left.is_direct))
    ))[0] ?? null;
}

function chineseClueScore(meaning, translation) {
  const source = new Set(
    String(meaning ?? "").replace(/[^\u3400-\u9fff]/g, ""),
  );
  const target = new Set(
    String(translation ?? "").replace(/[^\u3400-\u9fff]/g, ""),
  );
  if (!source.size || !target.size) return 0;
  let overlap = 0;
  source.forEach((char) => {
    if (target.has(char)) overlap += 1;
  });
  return overlap / source.size;
}

function tatoebaCandidates(word, sense, cacheEntry, senseCount) {
  const forms = wordForms(word);
  return (cacheEntry?.data ?? []).flatMap((sentence) => {
    const translation = simplifiedTranslation(sentence);
    if (!translation || !containsForm(sentence.text, forms)) return [];
    const definitionOverlap = lexicalScore(sense.definition, sentence.text);
    const chineseOverlap = chineseClueScore(sense.meaning, translation.text);
    if (
      senseCount > 1
      && definitionOverlap < 0.08
      && chineseOverlap < 0.55
    ) {
      return [];
    }
    const score = sentenceScore(word, sense, sentence.text, "tatoeba")
      + Math.min(35, chineseOverlap * 45)
      + (translation.is_direct ? 10 : 2);
    if (!Number.isFinite(score)) return [];
    return [{
      text: cleanSentence(sentence.text),
      zh: cleanSentence(translation.text),
      source: "tatoeba",
      score,
      metadata: {
        exampleSourceId: sentence.id,
        exampleTranslationId: translation.id,
        exampleLicense: sentence.license ?? "CC BY 2.0 FR",
        exampleOwner: sentence.owner ?? null,
      },
    }];
  });
}

function englishTatoebaCandidates(word, sense, cacheEntry, senseCount) {
  const forms = wordForms(word);
  return (cacheEntry?.data ?? []).flatMap((sentence) => {
    if (!containsForm(sentence.text, forms)) return [];
    const definitionOverlap = lexicalScore(sense.definition, sentence.text);
    const minimumOverlap = senseCount > 1 ? 0.09 : 0.045;
    if (definitionOverlap < minimumOverlap) return [];
    const score = sentenceScore(word, sense, sentence.text, "tatoeba")
      + Math.min(42, definitionOverlap * 90);
    if (!Number.isFinite(score)) return [];
    return [{
      text: cleanSentence(sentence.text),
      zh: "",
      source: "tatoeba",
      score,
      metadata: {
        exampleSourceId: sentence.id,
        exampleLicense: sentence.license ?? "CC BY 2.0 FR",
        exampleOwner: sentence.owner ?? null,
      },
    }];
  });
}

const DICTIONARY_POS = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  preposition: "prep.",
  conjunction: "conj.",
  pronoun: "pron.",
  interjection: "int.",
};

function dictionaryApiCandidates(word, sense, cacheEntry) {
  const definitions = (Array.isArray(cacheEntry) ? cacheEntry : [])
    .flatMap((entry) => entry?.meanings ?? [])
    .filter((meaning) => DICTIONARY_POS[meaning.partOfSpeech] === sense.pos)
    .flatMap((meaning) => meaning.definitions ?? [])
    .filter((definition) => definition?.definition && definition?.example)
    .map((definition) => ({
      ...definition,
      matchScore: lexicalScore(sense.definition, definition.definition),
    }))
    .sort((left, right) => right.matchScore - left.matchScore);
  const topScore = definitions[0]?.matchScore ?? 0;
  if (topScore < 0.1) return [];
  return definitions
    .filter((definition) => (
      definition.matchScore >= 0.1
      && definition.matchScore >= topScore - 0.14
    ))
    .slice(0, 5)
    .flatMap((definition) => {
      const score = sentenceScore(
        word,
        sense,
        definition.example,
        "dictionary",
      ) + Math.min(30, definition.matchScore * 45);
      if (!Number.isFinite(score)) return [];
      return [{
        text: cleanSentence(definition.example),
        zh: "",
        source: "dictionaryapi-wiktionary",
        score,
        metadata: {
          exampleLicense: "CC BY-SA 3.0",
        },
      }];
    });
}

function currentExampleCandidate(word, sense) {
  if (
    !sense.example
    || sense.exampleSource === "generated-high-context"
    || /-definition$/.test(sense.exampleSource ?? "")
  ) {
    return [];
  }
  const score = sentenceScore(word, sense, sense.example, sense.exampleSource);
  if (!Number.isFinite(score)) return [];
  return [{
    text: cleanSentence(sense.example),
    zh: sense.exampleZh ? cleanSentence(sense.exampleZh) : "",
    source: sense.exampleSource,
    score,
    metadata: {},
  }];
}

function kaikkiCandidates(word, sense, matches) {
  const topScore = matches[0]?.matchScore ?? 0;
  if (topScore < 0.1) return [];
  return matches
    .filter((match) => (
      match.matchScore >= 0.1
      && match.matchScore >= topScore - 0.16
    ))
    .slice(0, 6)
    .flatMap((match) => [
      ...(match.sense.examples ?? []).map((text) => ({
        text,
        source: "kaikki-wiktionary",
        sourceBoost: 18,
      })),
      ...(match.sense.quotations ?? []).map((text) => ({
        text,
        source: "kaikki-quotation",
        sourceBoost: 8,
      })),
    ].flatMap((candidate) => {
      const score = sentenceScore(word, sense, candidate.text, candidate.source)
        + candidate.sourceBoost
        + Math.min(24, match.matchScore * 36);
      if (!Number.isFinite(score)) return [];
      return [{
        text: cleanSentence(candidate.text),
        zh: "",
        source: candidate.source,
        score,
        metadata: {
          exampleLicense: "CC BY-SA 3.0",
        },
      }];
    }));
}

function mergeAuthoritativeSenses(wordEntry, authoritative) {
  if (!authoritative.length) return wordEntry.senses;
  const retained = wordEntry.senses.filter((sense) => {
    if (sense.auditStatus !== "dictionary-verified") return true;
    return authoritative.some((candidate) => (
      candidate.pos === sense.pos
      && lexicalScore(candidate.definition, sense.definition) >= 0.25
    ));
  });

  for (const candidate of authoritative) {
    const existing = retained
      .map((sense) => ({
        sense,
        score: sense.pos === candidate.pos
          ? lexicalScore(sense.definition, candidate.definition)
          : 0,
      }))
      .sort((left, right) => right.score - left.score)[0];
    if (existing?.score >= 0.25) {
      existing.sense.meaning = candidate.meaning;
      existing.sense.definition = candidate.definition;
      existing.sense.meaningSource = "kaikki-mandarin-translation";
      existing.sense.definitionSource = "kaikki-wiktionary";
      existing.sense.ipa = candidate.ipa || existing.sense.ipa;
      existing.sense.audio = candidate.audio || existing.sense.audio;
      continue;
    }
    retained.push({
      id: `kaikki-${retained.length + 1}`,
      pos: candidate.pos,
      meaning: candidate.meaning,
      definition: candidate.definition,
      example: "",
      exampleZh: "",
      exampleSource: "",
      meaningSource: "kaikki-mandarin-translation",
      definitionSource: "kaikki-wiktionary",
      auditStatus: "kaikki-bilingual-verified",
      ipa: candidate.ipa,
      audio: candidate.audio,
      importance: Math.max(1, 100 - retained.length * 3),
    });
  }
  return retained;
}

async function main() {
  const [
    words,
    kaikkiCache,
    authoritativeRows,
    tatoebaCache,
    englishTatoebaCache,
    dictionaryExampleCache,
  ] = await Promise.all([
    readFile(path.join(dataDir, "ielts-new-words.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataDir, "ielts-kaikki-cache.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataDir, "ielts-kaikki-sense-matches.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataDir, "ielts-tatoeba-cache.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({})),
    readFile(path.join(dataDir, "ielts-tatoeba-english-cache.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({})),
    readFile(path.join(dataDir, "ielts-dictionary-example-cache.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({})),
  ]);
  const authoritativeByWord = new Map(
    authoritativeRows.map((entry) => [entry.word, entry.matches]),
  );
  morphologyByWord = new Map(
    words.map((entry) => [entry.word.toLowerCase(), entry.morphology ?? {}]),
  );
  const report = {
    words: words.length,
    senses: 0,
    sourceCounts: {},
    unresolved: [],
    authoritativeWords: 0,
    authoritativeSenses: 0,
  };

  for (const wordEntry of words) {
    const authoritative = authoritativeByWord.get(wordEntry.word) ?? [];
    if (authoritative.length) {
      report.authoritativeWords += 1;
      report.authoritativeSenses += authoritative.length;
      wordEntry.senses = mergeAuthoritativeSenses(wordEntry, authoritative);
    }
    const usedExamples = new Set();
    for (const [senseIndex, sense] of wordEntry.senses.entries()) {
      sense.id = `sense-${senseIndex + 1}`;
      sense.importance = Math.max(1, 100 - senseIndex * 3);
      sense.definitionSentence = cleanSentence(sense.definition);
      sense.definitionZh = cleanSentence(sense.meaning);
      const kaikkiMatches = rankedKaikkiMatches(
        kaikkiCache[wordEntry.word],
        sense,
      );
      const kaikkiMatch = kaikkiMatches[0]?.matchScore >= 0.1
        ? kaikkiMatches[0]
        : null;
      if (kaikkiMatch) {
        sense.ipa = sense.ipa
          || (kaikkiMatch.entry.sounds ?? []).find((sound) => sound.ipa)?.ipa
          || "";
        sense.audio = sense.audio
          || (kaikkiMatch.entry.sounds ?? []).find((sound) => sound.audio)?.audio
          || "";
      }
      const candidates = [
        ...currentExampleCandidate(wordEntry.word, sense),
        ...kaikkiCandidates(wordEntry.word, sense, kaikkiMatches),
        ...tatoebaCandidates(
          wordEntry.word,
          sense,
          tatoebaCache[wordEntry.word],
          wordEntry.senses.length,
        ),
        ...englishTatoebaCandidates(
          wordEntry.word,
          sense,
          englishTatoebaCache[wordEntry.word],
          wordEntry.senses.length,
        ),
        ...dictionaryApiCandidates(
          wordEntry.word,
          sense,
          dictionaryExampleCache[wordEntry.word],
        ),
      ].sort((left, right) => right.score - left.score);
      const selected = candidates.find((candidate) => (
        !usedExamples.has(candidate.text.toLowerCase())
      ));
      if (selected) {
        usedExamples.add(selected.text.toLowerCase());
        sense.example = selected.text;
        sense.exampleZh = selected.zh;
        sense.exampleSource = selected.source;
        sense.exampleQualityScore = Math.round(selected.score * 1000) / 1000;
        Object.assign(sense, selected.metadata);
      } else {
        sense.example = "";
        sense.exampleZh = "";
        sense.exampleSource = "";
        report.unresolved.push({
          word: wordEntry.word,
          senseId: sense.id,
          pos: sense.pos,
          meaning: sense.meaning,
          definition: sense.definition,
        });
      }
      report.sourceCounts[sense.exampleSource || "unresolved"] =
        (report.sourceCounts[sense.exampleSource || "unresolved"] ?? 0) + 1;
      report.senses += 1;
    }
  }

  await writeFile(
    path.join(dataDir, "ielts-new-words.json"),
    `${JSON.stringify(words, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(dataDir, "ielts-open-content-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify({
    words: report.words,
    senses: report.senses,
    authoritativeWords: report.authoritativeWords,
    authoritativeSenses: report.authoritativeSenses,
    sourceCounts: report.sourceCounts,
    unresolved: report.unresolved.length,
  }, null, 2));
}

await main();
