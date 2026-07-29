import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "data");

const EXCLUDED_TAGS = new Set([
  "abbreviation",
  "alt-of",
  "alternative",
  "archaic",
  "dated",
  "dialectal",
  "historical",
  "misspelling",
  "nonstandard",
  "obsolete",
  "offensive",
  "rare",
  "slang",
]);
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
  "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
]);

function englishTokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function lexicalScore(left, right) {
  const leftTokens = new Set(englishTokens(left));
  const rightTokens = new Set(englishTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.sqrt(leftTokens.size * rightTokens.size);
}

function cleanChinese(value) {
  const text = String(value ?? "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const alternatives = text.split(/\s*\/\s*/).filter(Boolean);
  const preferred = alternatives.at(-1) ?? text;
  return preferred.replace(/[^\u3400-\u9fff]/g, "");
}

function chineseScore(left, right) {
  const a = cleanChinese(left);
  const b = cleanChinese(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a))) {
    return 0.88;
  }
  const leftChars = new Set(a);
  const rightChars = new Set(b);
  let overlap = 0;
  leftChars.forEach((char) => {
    if (rightChars.has(char)) overlap += 1;
  });
  return (2 * overlap) / (leftChars.size + rightChars.size);
}

function sourceGroups(source) {
  const groups = [];
  for (const [lineIndex, line] of (source?.translations ?? []).entries()) {
    for (const [partIndex, part] of String(line.translation ?? "")
      .split(/[;,，；、/]/)
      .entries()) {
      const meaning = cleanChinese(part);
      if (!meaning) continue;
      groups.push({
        meaning,
        pos: line.type ?? "",
        order: lineIndex * 100 + partIndex,
      });
    }
  }
  return groups;
}

function isExcluded(sense) {
  return (sense.tags ?? []).some((tag) => EXCLUDED_TAGS.has(String(tag).toLowerCase()));
}

function matchTranslationToSense(entry, translation) {
  const candidates = entry.senses
    .map((sense, index) => {
      const gloss = sense.glosses.at(-1) ?? sense.glosses[0] ?? "";
      return {
        sense,
        index,
        gloss,
        score: lexicalScore(translation.sense, gloss),
      };
    })
    .filter((candidate) => candidate.gloss && !isExcluded(candidate.sense))
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  if (!best) return null;
  if (best.score < 0.2 && candidates.length > 1) return null;
  return best;
}

function matchesForWord(word, source, cacheEntry) {
  const groups = sourceGroups(source);
  const matches = [];
  for (const [entryIndex, entry] of (cacheEntry?.entries ?? []).entries()) {
    for (const translation of entry.translations ?? []) {
      if ((translation.tags ?? []).some((tag) => EXCLUDED_TAGS.has(String(tag).toLowerCase()))) {
        continue;
      }
      const sourceMatches = groups
        .map((group) => ({
          group,
          score: chineseScore(group.meaning, translation.word),
        }))
        .filter((candidate) => candidate.score >= 0.8)
        .sort((left, right) => (
          right.score - left.score || left.group.order - right.group.order
        ));
      if (!sourceMatches.length) continue;
      const paired = matchTranslationToSense(entry, translation);
      if (!paired) continue;
      matches.push({
        word,
        pos: entry.pos,
        meaning: cleanChinese(translation.word),
        sourceMeaning: sourceMatches[0].group.meaning,
        sourceOrder: sourceMatches[0].group.order,
        sourceScore: sourceMatches[0].score,
        definition: paired.gloss,
        examples: paired.sense.examples,
        tags: paired.sense.tags,
        topics: paired.sense.topics,
        ipa: (entry.sounds ?? []).find((sound) => sound.ipa)?.ipa ?? "",
        audio: (entry.sounds ?? []).find((sound) => sound.audio)?.audio ?? "",
        translationSense: translation.sense,
        entryIndex,
        senseIndex: paired.index,
      });
    }
  }

  const deduped = new Map();
  for (const match of matches) {
    const key = `${match.pos}|${match.definition.toLowerCase()}`;
    const existing = deduped.get(key);
    if (
      !existing
      || match.sourceScore > existing.sourceScore
      || (
        match.sourceScore === existing.sourceScore
        && match.sourceOrder < existing.sourceOrder
      )
    ) {
      deduped.set(key, match);
    } else if (
      match.meaning !== existing.meaning
      && !existing.meaning.includes(match.meaning)
    ) {
      existing.meaning = `${existing.meaning}，${match.meaning}`;
    }
  }
  return [...deduped.values()].sort((left, right) => (
    left.sourceOrder - right.sourceOrder
    || left.entryIndex - right.entryIndex
    || left.senseIndex - right.senseIndex
  ));
}

async function main() {
  const [words, sources, cache] = await Promise.all([
    readFile(path.join(dataDir, "ielts-new-words.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataDir, "ielts-source.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataDir, "ielts-kaikki-cache.json"), "utf8").then(JSON.parse),
  ]);
  const sourceByWord = new Map(sources.map((source) => [source.word, source]));
  const output = [];
  for (const word of words) {
    output.push({
      word: word.word,
      matches: matchesForWord(word.word, sourceByWord.get(word.word), cache[word.word]),
    });
  }
  await writeFile(
    path.join(dataDir, "ielts-kaikki-sense-matches.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  const matched = output.filter((entry) => entry.matches.length);
  const report = {
    words: words.length,
    matchedWords: matched.length,
    matchedSenses: matched.reduce((count, entry) => count + entry.matches.length, 0),
    wordsWithExamples: matched.filter((entry) => (
      entry.matches.some((match) => match.examples.length)
    )).length,
    wordsWithAudio: matched.filter((entry) => (
      entry.matches.some((match) => match.audio)
    )).length,
  };
  console.log(JSON.stringify(report, null, 2));
}

await main();
