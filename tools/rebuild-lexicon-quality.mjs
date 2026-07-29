import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EXTRA_MEANING_HINTS, MEANING_HINTS } from "./enrich-examples-wordnet.mjs";

const require = createRequire(import.meta.url);
const wordnetDb = require("wordnet-db");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const wordsPath = path.join(rootDir, "data", "kaoyan-words.json");
const sourcePath = path.join(rootDir, "data", "kaoyan-source.json");
const overridesPath = path.join(rootDir, "data", "sense-overrides.json");
const backupPath = path.join(rootDir, "data", "kaoyan-words.before-quality-rebuild.json");
const reportPath = path.join(rootDir, "data", "lexicon-quality-report.json");
const candidatesPath = path.join(rootDir, "data", "example-candidates.json");

const DRY_RUN = process.argv.includes("--dry-run");
const previewArg = process.argv.find((arg) => arg.startsWith("--preview="));

const POS_FILES = {
  "n.": { index: "index.noun", data: "data.noun" },
  "v.": { index: "index.verb", data: "data.verb" },
  "adj.": { index: "index.adj", data: "data.adj" },
  "adv.": { index: "index.adv", data: "data.adv" },
};

const POS_ORDER = ["n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "num.", "int.", "abbr."];

const PLACEHOLDER_PATTERN = /helpful sentence|needs clue words|points to a specific meaning|rather than a generic sentence|points to an action|action rather than a thing|do this action in a specific situation|when the action itself is the key idea|people use .* to add detail|describes how an action is done|changes the manner, degree, or time|physical thing used, carried, seen, or touched|quality that separates|has this quality|describes what|should make this sense clear|in this context,?\s*["']?[^"']+["']?\s+means|collocation that points|names a place where people can go or work|usually refers to someone who|can be a long narrow strip|to\s+\w+\s+use something is to use it|a strong \w+ can change what people think|the person in \w+ is responsible|this use of|this sense of/i;

const PERSON_NAME_PATTERN = /人名|姓氏|\bname\b/i;
const BAD_MEANING_PATTERN = /(?:^|[\s，,；;])(n|v|vt|vi|adj|adv|prep|conj|pron|num)\s*\.?\s*(?=[\u4e00-\u9fff])/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanWordNetText(text) {
  return String(text || "").replace(/_/g, " ").trim();
}

function splitGloss(glossary) {
  const parts = String(glossary || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const definition = cleanWordNetText(parts[0] || "");
  const examples = parts
    .slice(1)
    .map((part) => part.match(/"([^"]+)"/)?.[1])
    .filter(Boolean)
    .map(cleanWordNetText);
  return { definition, examples };
}

function parseIndexLine(line) {
  if (!line || line.startsWith("  ")) return null;
  const columns = line.trim().split(/\s+/);
  if (columns.length < 6) return null;
  const pointerCount = Number(columns[3]);
  const synsetCountIndex = 4 + pointerCount;
  const synsetCount = Number(columns[synsetCountIndex]);
  if (!Number.isFinite(pointerCount) || !Number.isFinite(synsetCount)) return null;
  return {
    lemma: cleanWordNetText(columns[0]).toLowerCase(),
    offsets: columns.slice(synsetCountIndex + 2, synsetCountIndex + 2 + synsetCount),
  };
}

function parseDataLine(line) {
  const glossaryIndex = line.indexOf("|");
  if (glossaryIndex === -1) return null;
  const head = line.slice(0, glossaryIndex).trim().split(/\s+/);
  const wordCount = Number.parseInt(head[3], 16);
  if (!Number.isFinite(wordCount)) return null;
  const words = [];
  for (let index = 0; index < wordCount; index += 1) {
    words.push(cleanWordNetText(head[4 + index * 2]));
  }
  const { definition, examples } = splitGloss(line.slice(glossaryIndex + 1));
  return { offset: head[0], words, definition, examples };
}

function loadWordNet() {
  const result = {};
  for (const [pos, files] of Object.entries(POS_FILES)) {
    const indexByLemma = new Map();
    const dataByOffset = new Map();
    const indexText = fs.readFileSync(path.join(wordnetDb.path, files.index), "utf8");
    for (const line of indexText.split(/\r?\n/)) {
      const parsed = parseIndexLine(line);
      if (parsed) indexByLemma.set(parsed.lemma, parsed.offsets);
    }
    const dataText = fs.readFileSync(path.join(wordnetDb.path, files.data), "utf8");
    for (const line of dataText.split(/\r?\n/)) {
      const parsed = parseDataLine(line);
      if (parsed) dataByOffset.set(parsed.offset, parsed);
    }
    result[pos] = { indexByLemma, dataByOffset };
  }
  return result;
}

function expandType(type) {
  const normalized = String(type || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .replace(/^a$/, "adj")
    .replace(/^ad$/, "adv")
    .replace(/^vt$|^vi$/, "v")
    .replace(/^a&ad$/, "adj&adv")
    .replace(/^adv&adj$/, "adj&adv")
    .replace(/^v&n$|^vt&n$/, "n&v");

  const map = {
    n: "n.",
    v: "v.",
    adj: "adj.",
    adv: "adv.",
    prep: "prep.",
    conj: "conj.",
    pron: "pron.",
    num: "num.",
    int: "int.",
    abbr: "abbr.",
  };

  return Array.from(new Set(normalized.split("&").map((part) => map[part]).filter(Boolean)));
}

function parseTranslationLine(line) {
  const declaredTypes = expandType(line.type);
  let text = String(line.translation || "").trim();
  const prefixCombo = text.match(/^[&/]?(n&v|v&n|n&adj|adj&n|adj&adv|adv&adj|a&ad)\.?/i);
  let prefixTypes = [];
  if (prefixCombo) {
    prefixTypes = expandType(prefixCombo[1]);
    text = text.slice(prefixCombo[0].length);
  }
  text = text.replace(/([；;\s])(vt|vi)(?=[\u4e00-\u9fff])/gi, "$1$2.");
  text = text.replace(/^[&/]+/, "");

  const markerPattern = /(adj|adv|prep|conj|pron|num|abbr|int|vt|vi|n|v|a)\s*\./gi;
  const markers = Array.from(text.matchAll(markerPattern));
  if (!markers.length) {
    return [{ types: prefixTypes.length ? prefixTypes : declaredTypes, text }];
  }

  const parts = [];
  const firstMarker = markers[0];
  const before = text.slice(0, firstMarker.index).trim();
  if (before) parts.push({ types: declaredTypes, text: before });

  markers.forEach((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? text.length;
    const value = text.slice(start, end).trim();
    if (!value) return;
    let types = expandType(marker[1]);
    if (index === 0 && !before) {
      types = Array.from(new Set([...declaredTypes, ...prefixTypes, ...types]));
    }
    parts.push({ types, text: value });
  });

  return parts.length ? parts : [{ types: declaredTypes, text }];
}

function cleanMeaning(text) {
  let value = String(text || "")
    .replace(/\(pl\.\)|\[pl\.\]/gi, "（复数）")
    .replace(/\[(?:美|英|古|计|语|医|物理|化|动|植|口|俚|俗)[^\]]*\]/g, "")
    .replace(/\((?:from|against|to|of|with|in|on)\)/gi, "")
    .replace(/[<＞>“”‘’]/g, "")
    .replace(/\b(?:vt|vi|n|v|adj|adv|prep|conj|pron|num)\s*\.?\s*/gi, "")
    .replace(/拋/g, "抛")
    .replace(/宴情/g, "宴请")
    .replace(/[;,；]+/g, "，")
    .replace(/\s*,\s*/g, "，")
    .replace(/\s+/g, "")
    .replace(/^[，、:：/]+|[，、:：/A]+$/g, "");

  const tokens = value
    .split(/[，、]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  value = Array.from(new Set(tokens)).join("，");
  return value;
}

function normalizeMeaning(text) {
  return cleanMeaning(text).replace(/[（）()…·\-]/g, "").toLowerCase();
}

function meaningTokens(text) {
  return cleanMeaning(text)
    .replace(/（[^）]*）/g, "")
    .split(/[，、；;\/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function meaningMatchScore(left, right) {
  const a = normalizeMeaning(left);
  const b = normalizeMeaning(right);
  if (!a || !b) return 0;
  if (a === b) return 120;
  if (a.includes(b) || b.includes(a)) return 90;
  const leftTokens = meaningTokens(left);
  const rightTokens = meaningTokens(right);
  let score = 0;
  for (const leftToken of leftTokens) {
    for (const rightToken of rightTokens) {
      if (leftToken === rightToken) score = Math.max(score, 75);
      else if (leftToken.includes(rightToken) || rightToken.includes(leftToken)) score = Math.max(score, 55);
    }
  }
  const leftChars = new Set(a.match(/[\u4e00-\u9fff]/g) || []);
  const rightChars = new Set(b.match(/[\u4e00-\u9fff]/g) || []);
  const shared = [...leftChars].filter((char) => rightChars.has(char)).length;
  const dice = leftChars.size + rightChars.size ? (shared * 2) / (leftChars.size + rightChars.size) : 0;
  if (dice >= 0.75) score = Math.max(score, 70);
  else if (dice >= 0.6) score = Math.max(score, 60);
  else if (dice >= 0.5) score = Math.max(score, 45);
  return score;
}

function tokenizeEnglish(text) {
  const stopWords = new Set(["a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "with", "by", "as", "at", "from", "is", "are"]);
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/(?:ing|ed|es|s)$/i, ""))
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function clueTokensForMeaning(meaning) {
  const clues = [];
  for (const [chineseTokens, englishTokens] of [...MEANING_HINTS, ...EXTRA_MEANING_HINTS]) {
    if (chineseTokens.some((token) => String(meaning).includes(token))) clues.push(...englishTokens);
  }
  return Array.from(new Set(clues.flatMap(tokenizeEnglish)));
}

function phraseClues(sourceEntry, meaning) {
  const terms = meaningTokens(meaning);
  const clues = [];
  for (const phrase of sourceEntry.phrases || []) {
    const translation = cleanMeaning(phrase.translation);
    const matched = terms.some((term) => {
      if (term.length >= 2) return translation.includes(term) || term.includes(translation);
      return ["岸", "堤", "法", "钱", "音", "声", "水", "光", "热"].includes(term) && translation.includes(term);
    });
    if (matched) clues.push(...tokenizeEnglish(phrase.phrase));
  }
  return Array.from(new Set(clues));
}

function candidateTextTokens(candidate) {
  return new Set(tokenizeEnglish(`${candidate.definition} ${candidate.examples.join(" ")} ${candidate.words.join(" ")}`));
}

function scoreCandidate(candidate, candidateIndex, group, sourceEntry, historyEntries) {
  const candidateTokens = candidateTextTokens(candidate);
  const meaningClues = clueTokensForMeaning(group.meaning);
  const collocationClues = phraseClues(sourceEntry, group.meaning);
  let score = Math.max(0, 4 - candidateIndex);

  for (const clue of meaningClues) {
    if (candidateTokens.has(clue)) score += 12;
  }
  for (const clue of collocationClues) {
    if (candidateTokens.has(clue)) score += 9;
  }

  for (const history of historyEntries || []) {
    const overlap = meaningMatchScore(group.meaning, history.meaning);
    if (!overlap || history.pos !== group.pos || history.selectedDefinition !== candidate.definition) continue;
    if (history.hintHits > 0) score += 28 + history.hintHits * 4;
    else if (history.usedDictionary && history.selectedScore >= 50) score += 14;
  }
  return score;
}

function chooseCandidate(candidates, usedIndexes, group, groupIndex, sourceEntry, historyEntries) {
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: usedIndexes.has(index) ? -1 : scoreCandidate(candidate, index, group, sourceEntry, historyEntries),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || Math.abs(left.index - groupIndex) - Math.abs(right.index - groupIndex));
  return ranked[0] || null;
}

function shouldDropMeaning(meaning) {
  return !meaning || PERSON_NAME_PATTERN.test(meaning) || BAD_MEANING_PATTERN.test(meaning);
}

function splitOutsideParentheses(text) {
  const result = [];
  let current = "";
  let depth = 0;
  for (const char of String(text || "")) {
    if ("（([".includes(char)) depth += 1;
    if ("）)]".includes(char)) depth = Math.max(0, depth - 1);
    if (depth === 0 && "，,、".includes(char)) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

export function sourceGroups(sourceEntry) {
  const groups = [];
  for (const line of sourceEntry.translations || []) {
    for (const part of parseTranslationLine(line)) {
      const meanings = part.text.split(/[;；]+/).map(cleanMeaning).filter(Boolean);
      for (const pos of part.types) {
        for (const meaning of meanings) {
          if (!shouldDropMeaning(meaning)) groups.push({ pos, meaning });
        }
      }
    }
  }

  const merged = [];
  for (const group of groups) {
    const normalized = normalizeMeaning(group.meaning);
    const duplicate = merged.find((item) => item.pos === group.pos && normalizeMeaning(item.meaning) === normalized);
    if (!duplicate) merged.push(group);
  }
  return merged;
}

function lookupCandidates(wordNet, word, pos) {
  const source = wordNet[pos];
  if (!source) return [];
  const lemma = word.toLowerCase().replace(/\s+/g, "_");
  const offsets = source.indexByLemma.get(lemma) || [];
  return offsets.map((offset) => source.dataByOffset.get(offset)).filter(Boolean);
}

function capitalize(text) {
  const value = String(text || "").trim();
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function tidySentence(text) {
  let value = String(text || "").replace(/\s+/g, " ").trim();
  value = value.replace(/\?\.$/, "?").replace(/!\.$/, "!");
  if (!/[.!?]$/.test(value)) value += ".";
  return capitalize(value);
}

function definitionExample(word, pos, candidate) {
  const definition = String(candidate?.definition || "").replace(/[.!?]+$/, "").trim();
  if (!definition) return "";
  let sentence = "";
  if (pos === "n.") {
    sentence = /^(?:a|an|the)\b/i.test(definition)
      ? `${capitalize(word)} is ${definition}`
      : `${capitalize(word)} means ${definition}`;
  } else if (pos === "v.") {
    sentence = /^to\b/i.test(definition)
      ? `${capitalize(word)} means ${definition}`
      : `To ${word} means to ${definition}`;
  } else if (pos === "adj.") {
    sentence = /^(?:of|relating|pertaining)\b/i.test(definition)
      ? `${capitalize(word)} means ${definition}`
      : `Something ${word} is ${definition}`;
  } else if (pos === "adv.") {
    sentence = `${capitalize(word)} means ${definition}`;
  }
  return tidySentence(sentence);
}

function lexemePattern(word) {
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const variants = [escaped];
  if (/e$/i.test(word)) variants.push(`${escaped.slice(0, -1)}(?:ed|ing)`, `${escaped}(?:s|d)`);
  else variants.push(`${escaped}(?:s|es|ed|ing)`);
  if (/y$/i.test(word)) variants.push(`${escaped.slice(0, -1)}(?:ies|ied)`);
  const final = escaped.at(-1);
  if (final && /[bcdfgklmnprst]/i.test(final)) variants.push(`${escaped}${final}(?:ed|ing)`);
  return new RegExp(`(?:^|[^a-z])(?:${variants.join("|")})(?=$|[^a-z])`, "i");
}

function containsLexeme(example, word) {
  return lexemePattern(word).test(String(example || ""));
}

function posShapeMismatch(example, word, pos) {
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (pos === "n." && new RegExp(`^To\\s+${escaped}\\b`, "i").test(example)) return true;
  if (pos === "v." && new RegExp(`^(?:A|An)\\s+${escaped}\\s+is\\b`, "i").test(example)) return true;
  if (pos === "adj." && new RegExp(`^(?:A|An)\\s+${escaped}\\s+is\\s+(?:a|an)\\b`, "i").test(example)) return true;
  return false;
}

function exampleIsUsable(example, word, pos) {
  const text = String(example || "").trim();
  if (!text || PLACEHOLDER_PATTERN.test(text)) return false;
  if (text.split(/\s+/).length < 5) return false;
  if (!containsLexeme(text, word)) return false;
  if (posShapeMismatch(text, word, pos)) return false;
  return true;
}

function legacySenses(wordEntry, pos) {
  return (wordEntry.senses || [])
    .filter((sense) => sense.pos === pos && exampleIsUsable(sense.example, wordEntry.word, pos))
    .sort((left, right) => {
      const sourceRank = (sense) => sense.exampleSource === "wordnet" ? 0 : sense.exampleSource === "manual" ? 1 : 2;
      return sourceRank(left) - sourceRank(right) || (right.exampleScore || 0) - (left.exampleScore || 0);
    });
}

function bestLegacySense(senses, meaning) {
  return senses
    .map((sense) => ({ sense, score: meaningMatchScore(meaning, sense.meaning) }))
    .filter((item) => item.score >= 55)
    .sort((left, right) => right.score - left.score || (right.sense.exampleScore || 0) - (left.sense.exampleScore || 0))[0]?.sense || null;
}

function mergeMeaning(left, right) {
  const tokens = `${left}，${right}`
    .split(/[，、]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens)).join("，");
}

function buildManualWord(wordEntry, override) {
  return {
    id: wordEntry.id || wordEntry.word,
    word: wordEntry.word,
    senses: override.senses.map((sense, index) => ({
      id: `${sense.pos.replace(/\W/g, "") || "sense"}-${index + 1}`,
      pos: sense.pos,
      meaning: cleanMeaning(sense.meaning),
      example: tidySentence(sense.example),
      importance: Math.max(1, 100 - index * 3),
      exampleSource: "manual",
      exampleQuality: "reviewed",
      exampleScore: 100,
    })),
  };
}

function refineGroupsWithLegacy(groups, wordEntry) {
  return groups.flatMap((group) => {
    const tokens = splitOutsideParentheses(group.meaning).map(cleanMeaning).filter(Boolean);
    if (tokens.length < 2) return [group];
    const usableLegacy = legacySenses(wordEntry, group.pos);
    const clusters = new Map();
    const unmatched = [];
    for (const token of tokens) {
      const legacy = bestLegacySense(usableLegacy, token);
      if (!legacy) {
        unmatched.push(token);
        continue;
      }
      const key = tidySentence(legacy.example).toLowerCase();
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(token);
    }
    if (clusters.size < 2) return [group];
    const result = [...clusters.values()].map((items) => ({ ...group, meaning: items.join("，") }));
    if (unmatched.length) result[0].meaning = mergeMeaning(result[0].meaning, unmatched.join("，"));
    return result;
  });
}

function buildWord(wordNet, wordEntry, sourceEntry, historyEntries) {
  const groups = refineGroupsWithLegacy(sourceGroups(sourceEntry), wordEntry);
  const groupCountByPos = new Map();
  for (const group of groups) groupCountByPos.set(group.pos, (groupCountByPos.get(group.pos) || 0) + 1);
  const candidatesByPos = new Map();
  const legacyByPos = new Map();
  const usedCandidateByPos = new Map();
  const groupIndexByPos = new Map();
  const senses = [];
  const dropped = [];

  for (const group of groups) {
    if (!candidatesByPos.has(group.pos)) {
      candidatesByPos.set(group.pos, lookupCandidates(wordNet, wordEntry.word, group.pos));
      legacyByPos.set(group.pos, legacySenses(wordEntry, group.pos));
      usedCandidateByPos.set(group.pos, new Set());
      groupIndexByPos.set(group.pos, 0);
    }

    const candidates = candidatesByPos.get(group.pos);
    const groupIndex = groupIndexByPos.get(group.pos);
    groupIndexByPos.set(group.pos, groupIndex + 1);
    const legacySense = bestLegacySense(legacyByPos.get(group.pos), group.meaning);
    let example = legacySense ? tidySentence(legacySense.example) : "";
    let source = legacySense ? "legacy-reviewed" : "";
    let score = legacySense ? Math.max(50, legacySense.exampleScore || 0) : 0;

    if (!exampleIsUsable(example, wordEntry.word, group.pos)) {
      const selected = chooseCandidate(
        candidates,
        usedCandidateByPos.get(group.pos),
        group,
        groupIndex,
        sourceEntry,
        historyEntries,
      );
      if (selected) {
        example = definitionExample(wordEntry.word, group.pos, selected.candidate);
        source = "wordnet";
        score = selected.score;
        usedCandidateByPos.get(group.pos).add(selected.index);
      }
    }

    if (!exampleIsUsable(example, wordEntry.word, group.pos)) {
      dropped.push({ ...group, reason: "no-trustworthy-example" });
      continue;
    }

    const normalizedExample = example.toLowerCase();
    const duplicate = senses.find((sense) => sense.example.toLowerCase() === normalizedExample);
    if (duplicate) {
      if (duplicate.pos === group.pos) {
        duplicate.meaning = mergeMeaning(duplicate.meaning, group.meaning);
      } else {
        dropped.push({ ...group, reason: "duplicate-example-across-pos" });
      }
      continue;
    }

    senses.push({
      pos: group.pos,
      meaning: group.meaning,
      example,
      exampleSource: source,
      exampleQuality: source === "wordnet" ? "dictionary-definition" : "reviewed-fallback",
      exampleScore: score,
    });
  }

  if (!senses.length) {
    const fallback = (wordEntry.senses || []).find((sense) => exampleIsUsable(sense.example, wordEntry.word, sense.pos));
    if (fallback) {
      senses.push({
        pos: fallback.pos,
        meaning: cleanMeaning(fallback.meaning),
        example: tidySentence(fallback.example),
        exampleSource: "legacy-reviewed",
        exampleQuality: "reviewed-fallback",
        exampleScore: 40,
      });
    }
  }

  senses.sort((left, right) => POS_ORDER.indexOf(left.pos) - POS_ORDER.indexOf(right.pos));
  const counters = new Map();
  const normalizedSenses = senses.map((sense, index) => {
    const key = sense.pos.replace(/\W/g, "") || "sense";
    const count = (counters.get(key) || 0) + 1;
    counters.set(key, count);
    return {
      id: `${key}-${count}`,
      ...sense,
      importance: Math.max(1, 100 - index * 3),
    };
  });

  return {
    word: { id: wordEntry.id || wordEntry.word, word: wordEntry.word, senses: normalizedSenses },
    dropped,
  };
}

function audit(words) {
  const placeholders = [];
  const duplicateExamples = [];
  const emptyExamples = [];
  const missingLexemes = [];
  const posMismatches = [];
  const malformedMeanings = [];
  const emptyWords = [];

  for (const word of words) {
    if (!word.senses.length) emptyWords.push(word.word);
    const exampleMap = new Map();
    for (const sense of word.senses) {
      const example = String(sense.example || "").trim();
      if (!example) emptyExamples.push({ word: word.word, ...sense });
      if (PLACEHOLDER_PATTERN.test(example)) placeholders.push({ word: word.word, ...sense });
      if (!containsLexeme(example, word.word)) missingLexemes.push({ word: word.word, ...sense });
      if (posShapeMismatch(example, word.word, sense.pos)) posMismatches.push({ word: word.word, ...sense });
      if (BAD_MEANING_PATTERN.test(sense.meaning)) malformedMeanings.push({ word: word.word, ...sense });
      const key = example.toLowerCase();
      if (!exampleMap.has(key)) exampleMap.set(key, []);
      exampleMap.get(key).push(sense);
    }
    for (const [example, senses] of exampleMap) {
      if (example && senses.length > 1) {
        duplicateExamples.push({ word: word.word, example, senses: senses.map((sense) => `${sense.pos} ${sense.meaning}`) });
      }
    }
  }

  return { placeholders, duplicateExamples, emptyExamples, missingLexemes, posMismatches, malformedMeanings, emptyWords };
}

function main() {
  const currentWords = readJson(wordsPath);
  const sourceRows = readJson(sourcePath);
  const overrides = readJson(overridesPath);
  const historyRows = fs.existsSync(candidatesPath) ? readJson(candidatesPath).candidates || [] : [];
  const firstSourceByWord = new Map();
  for (const row of sourceRows) {
    const key = row.word.toLowerCase();
    if (!firstSourceByWord.has(key)) firstSourceByWord.set(key, row);
  }
  const overrideByWord = new Map(overrides.map((entry) => [entry.word.toLowerCase(), entry]));
  const historyByWord = new Map();
  for (const row of historyRows) {
    if (!historyByWord.has(row.word)) historyByWord.set(row.word, []);
    historyByWord.get(row.word).push(row);
  }
  const wordNet = loadWordNet();
  const rebuilt = [];
  const dropped = [];
  let parsedSourceGroups = 0;
  const removedWords = [];

  for (const wordEntry of currentWords) {
    const key = wordEntry.word.toLowerCase();
    const override = overrideByWord.get(key);
    if (override) {
      if (override.remove) {
        removedWords.push(wordEntry.word);
        continue;
      }
      rebuilt.push(buildManualWord(wordEntry, override));
      continue;
    }
    const sourceEntry = firstSourceByWord.get(key);
    if (!sourceEntry) {
      rebuilt.push({ ...wordEntry, senses: [] });
      dropped.push({ word: wordEntry.word, reason: "missing-source-word" });
      continue;
    }
    parsedSourceGroups += sourceGroups(sourceEntry).length;
    const result = buildWord(wordNet, wordEntry, sourceEntry, historyByWord.get(wordEntry.word) || []);
    rebuilt.push(result.word);
    dropped.push(...result.dropped.map((item) => ({ word: wordEntry.word, ...item })));
  }

  const quality = audit(rebuilt);
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      words: rebuilt.length,
      sensesBefore: currentWords.reduce((sum, word) => sum + word.senses.length, 0),
      sensesAfter: rebuilt.reduce((sum, word) => sum + word.senses.length, 0),
      manualWords: overrides.length,
      removedWords,
      parsedSourceGroups,
      droppedSourceGroups: dropped.length,
      placeholderExamples: quality.placeholders.length,
      duplicateExampleGroups: quality.duplicateExamples.length,
      emptyExamples: quality.emptyExamples.length,
      examplesMissingTargetWord: quality.missingLexemes.length,
      missingTargetItems: quality.missingLexemes.map((item) => ({ word: item.word, pos: item.pos, meaning: item.meaning, example: item.example })),
      posShapeMismatches: quality.posMismatches.length,
      malformedMeanings: quality.malformedMeanings.length,
      emptyWords: quality.emptyWords.length,
      emptyWordList: quality.emptyWords,
      maxSensesPerWord: rebuilt
        .map((word) => ({ word: word.word, senses: word.senses.length }))
        .sort((left, right) => right.senses - left.senses)
        .slice(0, 10),
    },
    quality,
    droppedSourceGroups: dropped,
  };

  if (previewArg) {
    const requested = previewArg.slice("--preview=".length).split(",").map((word) => word.trim().toLowerCase()).filter(Boolean);
    console.log(JSON.stringify({
      summary: report.summary,
      words: Object.fromEntries(requested.map((word) => [word, rebuilt.find((entry) => entry.word.toLowerCase() === word) || null])),
    }, null, 2));
    return;
  }

  if (!DRY_RUN) {
    if (!fs.existsSync(backupPath)) fs.copyFileSync(wordsPath, backupPath);
    writeJson(wordsPath, rebuilt);
    writeJson(reportPath, report);
  }

  console.log(JSON.stringify({
    ...report.summary,
    output: DRY_RUN ? null : wordsPath,
    backup: DRY_RUN ? null : backupPath,
    report: DRY_RUN ? null : reportPath,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
