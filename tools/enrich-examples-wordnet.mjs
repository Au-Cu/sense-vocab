import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wndb = require("wordnet-db");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const wordsPath = path.join(rootDir, "data", "kaoyan-words.json");
const overridesPath = path.join(rootDir, "data", "example-overrides.json");
const candidatesPath = path.join(rootDir, "data", "example-candidates.json");
const reviewPath = path.join(rootDir, "data", "example-review-report.json");

const POS_FILES = {
  "n.": { index: "index.noun", data: "data.noun", tag: "noun" },
  "v.": { index: "index.verb", data: "data.verb", tag: "verb" },
  "adj.": { index: "index.adj", data: "data.adj", tag: "adjective" },
  "adj./adv.": { index: "index.adj", data: "data.adj", tag: "adjective" },
  "adv.": { index: "index.adv", data: "data.adv", tag: "adverb" },
};

const QUALITY = {
  DICTIONARY: "dictionary",
  PHRASE: "phrase",
  GENERATED: "generated",
  REVIEW: "needs-review",
};

export const MEANING_HINTS = [
  [["银行", "存款", "贷款"], ["money", "account", "loan", "deposit", "financial", "banking"]],
  [["岸", "堤", "河岸"], ["river", "water", "shore", "slope", "stream"]],
  [["首都"], ["capital", "government", "city", "seat"]],
  [["资本"], ["capital", "assets", "wealth", "money", "business"]],
  [["大写字母"], ["uppercase", "letter", "capital"]],
  [["声音", "语音", "噪音", "吵闹"], ["sound", "voice", "auditory", "hear", "noise", "music"]],
  [["海峡"], ["sound", "strait", "sea", "channel", "water"]],
  [["电流", "水流", "气流", "潮流", "趋势", "涌流"], ["current", "flow", "stream", "electricity", "trend"]],
  [["反应", "回应"], ["react", "respond", "response"]],
  [["反对", "反抗"], ["react", "oppose", "resist", "against"]],
  [["充电", "电荷"], ["charge", "electric", "battery", "positive", "negative"]],
  [["控告", "指责"], ["accuse", "charge", "crime", "blame"]],
  [["费用", "收费", "索费"], ["charge", "cost", "fee", "price", "pay"]],
  [["命令"], ["order", "command", "instruction"]],
  [["掌管", "负责"], ["responsible", "control", "care", "charge"]],
  [["行为", "行动", "动作", "举动"], ["act", "action", "do", "deed", "behavior"]],
  [["作用", "功能", "效用", "运转"], ["function", "effect", "operate", "work"]],
  [["文章", "论文"], ["article", "paper", "writing", "newspaper", "journal"]],
  [["条款", "条文"], ["article", "clause", "contract", "law", "agreement"]],
  [["冠词"], ["article", "grammar", "a", "an", "the"]],
  [["艺术", "美术"], ["art", "painting", "music", "creative", "artist"]],
  [["技术", "技艺"], ["skill", "technique", "craft"]],
  [["乐队"], ["band", "music", "musicians", "play"]],
  [["带", "条", "环"], ["band", "strip", "ring", "belt"]],
  [["波段"], ["band", "frequency", "radio", "wave"]],
  [["放弃", "抛弃", "遗弃", "丢弃", "离弃"], ["abandon", "leave", "forsake", "give up"]],
  [["放任", "狂热"], ["abandon", "restraint", "control", "reckless"]],
  [["人工", "人造"], ["artificial", "man-made", "synthetic", "natural"]],
  [["虚伪", "做作", "矫揉造作"], ["artificial", "false", "unnatural", "insincere"]],
  [["真实", "实际", "现实"], ["actual", "real", "true", "existing"]],
  [["目前", "当前", "现在"], ["current", "present", "now", "existing"]],
  [["主动语态"], ["active", "voice", "subject", "verb", "action"]],
  [["积极分子"], ["activist", "active", "campaigner", "political"]],
  [["性格", "品质"], ["character", "quality", "trait", "personality"]],
  [["人物", "角色"], ["character", "story", "fictional", "novel", "film"]],
  [["字符"], ["character", "letter", "symbol", "printed"]],
  [["特性", "特征"], ["feature", "characteristic", "quality"]],
];

export const EXTRA_MEANING_HINTS = [
  [["脸盆", "盆"], ["bowl", "wash", "vessel", "water", "liquid"]],
  [["水池"], ["pool", "water", "basin"]],
  [["流域"], ["river", "drain", "tributary", "water", "area"]],
  [["内海", "盆地", "洼地"], ["depression", "hollow", "land", "sea"]],
  [["电流"], ["electricity", "conductor", "ampere", "flow"]],
  [["水流", "气流", "涌流"], ["flow", "stream", "water", "air"]],
  [["潮流", "趋势"], ["trend", "tendency", "course", "direction", "movement"]],
  [["语音"], ["speech", "voice", "pronunciation", "phonetic"]],
  [["噪音", "吵闹"], ["noise", "loud", "unpleasant", "auditory"]],
  [["听力范围"], ["hear", "earshot", "distance", "audible"]],
  [["探条"], ["probe", "medical", "instrument"]],
  [["听"], ["hear", "listen", "seem", "appear"]],
  [["测量", "测深"], ["measure", "depth", "water"]],
  [["使发声"], ["ring", "alarm", "make"]],
  [["试探"], ["probe", "question", "test"]],
  [["宣告"], ["announce", "proclaim", "declare"]],
  [["健全", "健康"], ["healthy", "whole", "undamaged"]],
  [["合理", "可靠"], ["valid", "sensible", "reliable", "trustworthy"]],
  [["彻底", "充分"], ["deeply", "thoroughly", "soundly"]],
  [["文章"], ["prose", "writing", "newspaper", "magazine", "publication"]],
  [["论文"], ["paper", "journal", "academic", "publication", "prose"]],
  [["冠词"], ["grammar", "determiner", "definite", "indefinite"]],
  [["人工", "人造"], ["man-made", "synthetic", "nature", "natural", "contrived"]],
  [["虚伪", "做作", "矫揉造作"], ["false", "unnatural", "insincere", "formal", "stilted", "contrived"]],
  [["主动语态"], ["voice", "subject", "verb", "grammar", "action"]],
  [["积极分子"], ["activist", "campaigner", "political", "social"]],
];

const WEAK_HINT_WORDS = new Set(["a", "an", "the", "be", "is", "are", "sound", "current", "article", "active", "artificial", "capital", "character", "band", "charge", "react", "bank", "basin"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readOptionalJson(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, "").replace(/[，,；;、.。:：]/g, "");
}

function normalizePos(pos) {
  if (pos === "n.") return "n.";
  if (pos === "v.") return "v.";
  if (pos === "adj." || pos === "adj./adv.") return "adj.";
  if (pos === "adv.") return "adv.";
  return "";
}

function cleanWordnetText(text) {
  return String(text || "").replace(/_/g, " ").trim();
}

function splitGloss(glossary) {
  const parts = String(glossary || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const definition = cleanWordnetText(parts[0] || "");
  const examples = parts
    .slice(1)
    .map((part) => part.match(/"([^"]+)"/)?.[1])
    .filter(Boolean)
    .map(cleanWordnetText);
  return { definition, examples };
}

function parseIndexLine(line) {
  if (!line || line.startsWith("  ")) return null;
  const columns = line.trim().split(/\s+/);
  if (columns.length < 6) return null;

  const lemma = cleanWordnetText(columns[0]).toLowerCase();
  const pointerCount = Number(columns[3]);
  if (!Number.isFinite(pointerCount)) return null;
  const synsetCountIndex = 4 + pointerCount;
  const synsetCount = Number(columns[synsetCountIndex]);
  const offsetsStart = synsetCountIndex + 2;
  const offsets = columns.slice(offsetsStart, offsetsStart + synsetCount);
  return { lemma, offsets };
}

function parseDataLine(line) {
  const glossaryIndex = line.indexOf("|");
  if (glossaryIndex === -1) return null;
  const head = line.slice(0, glossaryIndex).trim().split(/\s+/);
  const offset = head[0];
  const ssType = head[2];
  const wordCount = Number.parseInt(head[3], 16);
  const words = [];
  for (let index = 0; index < wordCount; index += 1) {
    words.push(cleanWordnetText(head[4 + index * 2]));
  }
  const { definition, examples } = splitGloss(line.slice(glossaryIndex + 1));
  return { offset, ssType, words, definition, examples, glossary: cleanWordnetText(line.slice(glossaryIndex + 1)) };
}

function loadWordNet() {
  const result = {};
  for (const [pos, files] of Object.entries(POS_FILES)) {
    if (result[pos]) continue;
    const indexByLemma = new Map();
    const dataByOffset = new Map();

    const indexText = fs.readFileSync(path.join(wndb.path, files.index), "utf8");
    for (const line of indexText.split(/\r?\n/)) {
      const parsed = parseIndexLine(line);
      if (parsed) indexByLemma.set(parsed.lemma, parsed.offsets);
    }

    const dataText = fs.readFileSync(path.join(wndb.path, files.data), "utf8");
    for (const line of dataText.split(/\r?\n/)) {
      const parsed = parseDataLine(line);
      if (parsed) dataByOffset.set(parsed.offset, parsed);
    }

    result[pos] = { indexByLemma, dataByOffset };
  }
  result["adj./adv."] = result["adj."];
  return result;
}

function tokenizeEnglish(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function tokensForMeaning(meaning, word = "") {
  const hints = [];
  for (const [chineseTokens, englishTokens] of [...MEANING_HINTS, ...EXTRA_MEANING_HINTS]) {
    if (chineseTokens.some((token) => String(meaning || "").includes(token))) {
      hints.push(...englishTokens);
    }
  }
  const lowerWord = String(word || "").toLowerCase();
  return Array.from(new Set(hints))
    .map((hint) => hint.toLowerCase())
    .filter((hint) => hint && hint !== lowerWord && !WEAK_HINT_WORDS.has(hint));
}

function posMatches(expectedPos, wnType) {
  if (expectedPos === "n.") return wnType === "noun";
  if (expectedPos === "v.") return wnType === "verb";
  if (expectedPos === "adj." || expectedPos === "adj./adv.") return wnType === "adjective";
  if (expectedPos === "adv.") return wnType === "adverb";
  return false;
}

function scoreCandidate(word, sense, candidate) {
  const hints = tokensForMeaning(sense.meaning, word);
  const textTokens = new Set(tokenizeEnglish(`${candidate.definition} ${candidate.examples.join(" ")} ${candidate.words.join(" ")}`));
  const text = `${candidate.definition} ${candidate.examples.join(" ")} ${candidate.words.join(" ")}`.toLowerCase();
  let score = 0;
  let hintHits = 0;

  if (posMatches(sense.pos, candidate.posTag)) score += 12;
  if (candidate.words.some((item) => item.toLowerCase() === word.toLowerCase())) score += 6;
  if (candidate.examples.length) score += 10;
  if (candidate.definition) score += 3;

  for (const hint of hints) {
    const lowerHint = hint.toLowerCase();
    if (textTokens.has(lowerHint) || text.includes(lowerHint)) {
      hintHits += 1;
      score += 10;
    }
  }
  if (hints.length && hints.some((hint) => candidate.definition.toLowerCase().includes(hint.toLowerCase()))) score += 6;

  const phraseWords = candidate.words.filter((item) => item.includes(" "));
  if (phraseWords.length) score += 2;
  return { score, hints, hintHits };
}

function exampleFromCandidate(word, sense, candidate) {
  const direct = candidate.examples.find((example) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(example));
  if (direct) return direct.endsWith(".") ? direct : `${direct}.`;

  const example = candidate.examples[0];
  if (example) return example.endsWith(".") ? example : `${example}.`;

  const subject = candidate.words.find((item) => item.toLowerCase() === word.toLowerCase()) || word;
  return `${capitalize(subject)} means ${candidate.definition}.`;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(text) {
  const value = String(text || "");
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function lookupCandidates(wordNet, word, sense) {
  const pos = normalizePos(sense.pos);
  const source = wordNet[pos];
  if (!source) return [];

  const lemma = word.toLowerCase().replace(/\s+/g, "_");
  const offsets = source.indexByLemma.get(lemma) || [];
  return offsets
    .map((offset) => source.dataByOffset.get(offset))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      pos,
      posTag: POS_FILES[pos]?.tag || "",
    }));
}

function findOverride(overrides, wordEntry, sense) {
  return overrides.find((override) => {
    if (override.word !== wordEntry.word) return false;
    if (override.senseId && override.senseId === sense.id) return true;
    if (override.meaning && normalizeText(override.meaning) === normalizeText(sense.meaning)) return true;
    return false;
  });
}

function enhanceWord(wordNet, overrides, wordEntry) {
  const reviewItems = [];
  const candidateItems = [];

  const senses = wordEntry.senses.map((sense) => {
    const override = findOverride(overrides, wordEntry, sense);
    if (override) {
      return {
        ...sense,
        example: override.example,
        exampleSource: "manual",
        exampleQuality: QUALITY.DICTIONARY,
        exampleScore: 100,
      };
    }

    const candidates = lookupCandidates(wordNet, wordEntry.word, sense);
    const scored = candidates
      .map((candidate) => {
        const { score, hints, hintHits } = scoreCandidate(wordEntry.word, sense, candidate);
        return { candidate, score, hints, hintHits };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const hasHints = Boolean(best?.hints?.length);
    const hasSingleClearCandidate = candidates.length === 1 && best?.candidate.definition;
    const shouldUseDictionary = Boolean(
      best &&
      (
        (hasHints && best.hintHits > 0 && best.score >= 29) ||
        (!hasHints && hasSingleClearCandidate && best.score >= 18) ||
        (!hasHints && best.score >= 55)
      ),
    );
    const example = shouldUseDictionary ? exampleFromCandidate(wordEntry.word, sense, best.candidate) : sense.example;
    const quality = shouldUseDictionary ? QUALITY.DICTIONARY : qualityForExistingExample(sense.example);

    candidateItems.push({
      word: wordEntry.word,
      senseId: sense.id,
      pos: sense.pos,
      meaning: sense.meaning,
      selectedScore: best?.score || 0,
      selectedDefinition: best?.candidate.definition || "",
      selectedExamples: best?.candidate.examples || [],
      selectedWords: best?.candidate.words || [],
      hints: best?.hints || [],
      hintHits: best?.hintHits || 0,
      usedDictionary: shouldUseDictionary,
    });

    if (!shouldUseDictionary || quality === QUALITY.REVIEW) {
      reviewItems.push({
        word: wordEntry.word,
        senseId: sense.id,
        pos: sense.pos,
        meaning: sense.meaning,
        example,
        reason: !best
          ? "no-wordnet-candidate"
          : hasHints && best.hintHits === 0
            ? "no-meaning-hint-hit"
            : best.score < 29
              ? "low-wordnet-score"
              : "weak-existing-example",
        bestScore: best?.score || 0,
        hintHits: best?.hintHits || 0,
        hints: best?.hints || [],
        bestDefinition: best?.candidate.definition || "",
        bestExamples: best?.candidate.examples || [],
      });
    }

    return {
      ...sense,
      example,
      exampleSource: shouldUseDictionary ? "wordnet" : sense.exampleSource || "generated",
      exampleQuality: quality,
      exampleScore: best?.score || 0,
    };
  });

  return {
    word: { ...wordEntry, senses },
    reviewItems,
    candidateItems,
  };
}

function qualityForExistingExample(example) {
  const text = String(example || "");
  if (!text.trim()) return QUALITY.REVIEW;
  if (/specific context|specific situation|key idea|points to an action|quality that separates|has this quality|describes what|needs clue words|helpful sentence|generic sentence/i.test(text)) {
    return QUALITY.REVIEW;
  }
  if (/ means | is a | is an | are | refers to | used to | can be | where | when | because | such as | in which /i.test(text)) {
    return QUALITY.GENERATED;
  }
  return QUALITY.PHRASE;
}

function main() {
  const words = readJson(wordsPath);
  const overrides = readOptionalJson(overridesPath, []);
  const wordNet = loadWordNet();
  const enhancedWords = [];
  const reviewItems = [];
  const candidateItems = [];

  for (const wordEntry of words) {
    const result = enhanceWord(wordNet, overrides, wordEntry);
    enhancedWords.push(result.word);
    reviewItems.push(...result.reviewItems);
    candidateItems.push(...result.candidateItems);
  }

  const summary = {
    words: enhancedWords.length,
    senses: enhancedWords.reduce((sum, word) => sum + word.senses.length, 0),
    wordnetExamples: enhancedWords.flatMap((word) => word.senses).filter((sense) => sense.exampleSource === "wordnet").length,
    manualExamples: enhancedWords.flatMap((word) => word.senses).filter((sense) => sense.exampleSource === "manual").length,
    needsReview: reviewItems.length,
    generatedOrPhrase: enhancedWords.flatMap((word) => word.senses).filter((sense) => sense.exampleSource !== "wordnet").length,
  };

  writeJson(wordsPath, enhancedWords);
  writeJson(candidatesPath, { summary, candidates: candidateItems });
  writeJson(reviewPath, { summary, reviewItems });
  console.log(JSON.stringify({ ...summary, output: wordsPath, candidates: candidatesPath, review: reviewPath }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
