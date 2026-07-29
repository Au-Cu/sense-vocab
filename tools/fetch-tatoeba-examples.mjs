import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, "..");
const inputPath = path.join(rootDir, "data", "ielts-new-words.json");
const cachePath = path.join(rootDir, "data", "ielts-tatoeba-cache.json");
const reportPath = path.join(rootDir, "data", "ielts-tatoeba-report.json");
const concurrency = Math.max(1, Math.min(6, Number(process.argv[2]) || 4));

async function writeJsonAtomic(targetPath, value, pretty = false) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  const spacing = pretty ? 2 : 0;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, spacing)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "for",
  "from", "has", "have", "having", "in", "into", "is", "it", "its", "of",
  "on", "or", "that", "the", "their", "them", "this", "to", "was", "were",
  "which", "while", "with", "without", "someone", "something", "somebody",
]);
const TRIVIAL_PATTERNS = [
  /^(?:this|that|it|he|she|they|i|we)\s+(?:is|are|was|were|has|have)\b/i,
  /^(?:what|who|where|when|why|how|do|does|did|can|could|will|would|is|are)\b/i,
  /\b(?:thing|stuff|nice|good|bad|interesting)\b/i,
  /\b(?:tom|mary|john|jack)\b/i,
];

function tokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function wordForms(word) {
  const base = String(word.word ?? "").toLowerCase();
  const forms = new Set([base]);
  const morphology = word.morphology ?? {};
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
    if (base.endsWith("y")) forms.add(`${base.slice(0, -1)}ies`);
  }
  return [...forms].sort((left, right) => right.length - left.length);
}

function containsForm(sentence, forms) {
  const lower = String(sentence).toLowerCase();
  return forms.some((form) => {
    return new RegExp(`(^|[^a-z])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`)
      .test(lower);
  });
}

function chineseSignalScore(meaning, translation) {
  const source = String(meaning ?? "").replace(/[^\u3400-\u9fff]/g, "");
  const target = String(translation ?? "").replace(/[^\u3400-\u9fff]/g, "");
  if (!source || !target) return 0;
  const chars = new Set([...source]);
  let matches = 0;
  for (const char of new Set([...target])) {
    if (chars.has(char)) matches += 1;
  }
  return Math.min(18, matches * 3);
}

function candidateScore(word, sense, sentence) {
  const text = String(sentence.text ?? "").trim();
  const forms = wordForms(word);
  if (!containsForm(text, forms)) return Number.NEGATIVE_INFINITY;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5 || wordCount > 28) return Number.NEGATIVE_INFINITY;

  const translations = (sentence.translations ?? [])
    .filter((item) => item.lang === "cmn" && item.script === "Hans" && item.text);
  if (!translations.length) return Number.NEGATIVE_INFINITY;
  const translation = translations.sort((left, right) => {
    return Number(Boolean(right.is_direct)) - Number(Boolean(left.is_direct));
  })[0];

  const clueTokens = new Set(tokens([
    sense.definition,
    sense.definitionSentence,
    sense.meaning,
  ].join(" ")));
  const contextTokens = new Set(tokens(text).filter((token) => !forms.includes(token)));
  let clueMatches = 0;
  clueTokens.forEach((token) => {
    if (contextTokens.has(token)) clueMatches += 1;
  });

  let score = 80;
  score += Math.max(0, 18 - Math.abs(14 - wordCount) * 2);
  score += Math.min(30, clueMatches * 8);
  score += translation.is_direct ? 18 : 4;
  score += chineseSignalScore(sense.meaning, translation.text);
  score -= TRIVIAL_PATTERNS.reduce((sum, pattern) => sum + (pattern.test(text) ? 14 : 0), 0);
  if (/[?]$/.test(text)) score -= 16;
  if (/["']/.test(text)) score -= 2;
  if (sentence.owner) score += 2;
  return score;
}

function selectCandidate(word, sense, data) {
  const ranked = (Array.isArray(data) ? data : [])
    .map((sentence) => ({
      sentence,
      score: candidateScore(word, sense, sentence),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best) return null;
  const translation = (best.sentence.translations ?? [])
    .filter((item) => item.lang === "cmn" && item.script === "Hans" && item.text)
    .sort((left, right) => {
      return Number(Boolean(right.is_direct)) - Number(Boolean(left.is_direct));
    })[0];
  return {
    id: best.sentence.id,
    text: best.sentence.text,
    translationId: translation.id,
    translation: translation.text,
    directTranslation: Boolean(translation.is_direct),
    license: best.sentence.license ?? "CC BY 2.0 FR",
    owner: best.sentence.owner ?? null,
    score: best.score,
    alternatives: ranked.slice(1, 5).map((entry) => ({
      id: entry.sentence.id,
      text: entry.sentence.text,
      score: entry.score,
    })),
  };
}

async function fetchWord(word, attempt = 0) {
  const url = new URL("https://api.tatoeba.org/v1/sentences");
  url.searchParams.set("q", word);
  url.searchParams.set("lang", "eng");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("trans:lang", "cmn");
  url.searchParams.set("showtrans", "matching");
  url.searchParams.set("word_count", "5-28");
  url.searchParams.set("is_unapproved", "no");
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "sense-vocab-data-builder/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) return { error: `HTTP ${response.status}`, data: [] };
    const payload = await response.json();
    return { data: Array.isArray(payload.data) ? payload.data : [] };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (2 ** attempt)));
      return fetchWord(word, attempt + 1);
    }
    return { error: error?.message ?? String(error), data: [] };
  }
}

async function main() {
  const words = JSON.parse(await readFile(inputPath, "utf8"));
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    cache = {};
  }
  const queue = words
    .map((word) => word.word)
    .filter((word) => !Object.hasOwn(cache, word));
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const word = queue[index];
      cache[word] = await fetchWord(word);
      completed += 1;
      if (completed % 25 === 0 || completed === queue.length) {
        console.log(`Fetched ${completed}/${queue.length}: ${word}`);
        await writeJsonAtomic(cachePath, cache);
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await writeJsonAtomic(cachePath, cache);

  const report = [];
  for (const word of words) {
    for (const sense of word.senses) {
      const selected = selectCandidate(word, sense, cache[word.word]?.data);
      report.push({
        word: word.word,
        senseId: sense.id,
        pos: sense.pos,
        meaning: sense.meaning,
        definition: sense.definition || sense.definitionSentence,
        currentExample: sense.example,
        candidate: selected,
        fetchError: cache[word.word]?.error ?? null,
      });
    }
  }
  await writeJsonAtomic(reportPath, report, true);
  const selected = report.filter((entry) => entry.candidate);
  console.log(JSON.stringify({
    words: words.length,
    senses: report.length,
    selected: selected.length,
    directTranslations: selected.filter((entry) => entry.candidate.directTranslation).length,
    scoreAtLeast120: selected.filter((entry) => entry.candidate.score >= 120).length,
    scoreAtLeast100: selected.filter((entry) => entry.candidate.score >= 100).length,
    errors: Object.values(cache).filter((entry) => entry?.error).length,
  }, null, 2));
}

await main();
