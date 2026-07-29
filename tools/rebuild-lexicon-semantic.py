import argparse
import json
import math
import os
import re
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import ctranslate2
import numpy as np
import sentencepiece as spm
from fastembed import TextEmbedding


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
SOURCE_PATH = ROOT / "data" / "kaoyan-source.json"
MANUAL_PATH = ROOT / "data" / "sense-overrides.json"
FUNCTION_PATH = ROOT / "data" / "function-sense-overrides.json"
DICTIONARY_FALLBACK_PATH = ROOT / "data" / "dictionary-definition-fallbacks.json"
TRANSLATION_CACHE_PATH = ROOT / "data" / "definition-translation-cache.json"
SYNSET_CORRECTIONS_PATH = ROOT / "data" / "synset-meaning-corrections.json"
BACKUP_PATH = ROOT / "data" / "kaoyan-words.before-semantic-audit.json"
REPORT_PATH = ROOT / "data" / "lexicon-semantic-audit.json"

ZH_EN_MODEL = Path(os.environ.get("ARGOS_ZH_EN_MODEL_DIR", r"D:\Files\argos-zh-en-audit"))
EN_ZH_MODEL = Path(os.environ.get("ARGOS_EN_ZH_MODEL_DIR", r"D:\Files\argos-en-zh-audit"))
EMBED_MODEL = Path(
    os.environ.get(
        "SEMANTIC_EMBED_MODEL_DIR",
        str(Path(os.environ.get("TEMP", ".")) / "paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"),
    )
)

POS_FROM_WN = {"n": "n.", "v": "v.", "a": "adj.", "s": "adj.", "r": "adv."}
STANDARD_POS = set(POS_FROM_WN.values())
TYPE_MAP = {
    "n": "n.",
    "v": "v.",
    "vt": "v.",
    "vi": "v.",
    "a": "adj.",
    "adj": "adj.",
    "ad": "adv.",
    "adv": "adv.",
    "prep": "prep.",
    "conj": "conj.",
    "pron": "pron.",
    "num": "num.",
    "int": "int.",
    "abbr": "abbr.",
}

PLACEHOLDER_RE = re.compile(
    r"helpful sentence|stronger sentence|needs surrounding clue|needs clue words|"
    r"points to a specific meaning|rather than a generic sentence|has a specific sense|"
    r"object rather than an idea|person connected with this role|tool, machine, or set of things|"
    r"people can hold, use, move, or point|the child stood .* the door|"
    r"people use .* to add detail|describes how an action is done|"
    r"this use of|this sense of|in this context.*means",
    re.I,
)
PERSON_RE = re.compile(r"人名|姓氏|\b(?:born|died)\s+(?:in\s+)?\d{3,4}\b", re.I)
BIOGRAPHY_RE = re.compile(
    r"\b(?:United States|English|British|French|German|Italian|Russian|American)\s+"
    r"(?:actor|actress|writer|poet|artist|composer|politician|president|general|scientist|inventor)\b.*"
    r"\b(?:born|died|\d{4})\b"
    r"|\b\d{4}\s*[-–]\s*\d{4}\b"
    r"|\b(?:teacher|prophet|statesman|physicist|mathematician|philosopher)\b.*\bborn\b"
    r"|\bcirca\b.*\bBC\b.*\bAD\b",
    re.I,
)
STOP_WORDS = {
    "a",
    "an",
    "the",
    "to",
    "of",
    "and",
    "or",
    "for",
    "in",
    "on",
    "with",
    "by",
    "as",
    "at",
    "from",
    "is",
    "are",
    "be",
    "being",
    "something",
    "someone",
    "thing",
    "person",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_sentence(text):
    value = re.sub(r"\s+", " ", str(text or "")).strip()
    value = re.sub(r"\?\.$", "?", value)
    value = re.sub(r"!\.$", "!", value)
    if value and value[-1] not in ".!?":
        value += "."
    return value[:1].upper() + value[1:] if value else value


def clean_source_meaning(text):
    value = str(text or "")
    value = value.replace("拋", "抛").replace("宴情", "宴请")
    value = re.sub(r"\[(?:美|英|古|计|语|医|物理|化|动|植|口|俚|俗)[^\]]*\]", "", value)
    value = re.sub(r"\(pl\.\)|\[pl\.\]", "（复数）", value, flags=re.I)
    value = re.sub(r"^[\s/&]*(?:vt|vi|n|v|adj|adv|prep|conj|pron|num|int|abbr|a)\s*\.?", "", value, flags=re.I)
    value = re.sub(r"\b(?:vt|vi|n|v|adj|adv|prep|conj|pron|num|int|abbr)\s*\.\s*", "", value, flags=re.I)
    value = re.sub(r"[<>“”‘’]", "", value)
    value = re.sub(r"\s+", "", value)
    value = re.sub(r"^[，、:：/]+|[，、:：/A]+$", "", value)
    return value


def normalize_zh(text):
    return "".join(re.findall(r"[\u4e00-\u9fff]", str(text or "")))


def source_groups(source):
    groups = []
    for line_index, line in enumerate(source.get("translations", [])):
        raw_type = re.sub(r"[^a-z&]", "", str(line.get("type", "")).lower())
        declared = TYPE_MAP.get(raw_type)
        raw_text = str(line.get("translation", ""))
        prefix = re.match(r"^[\s/&]*(vt|vi|n|v|adj|adv|prep|conj|pron|num|int|abbr|a)\s*\.", raw_text, re.I)
        if prefix:
            declared = TYPE_MAP.get(prefix.group(1).lower(), declared)
        # ECDICT often puts several genuinely different Chinese senses on one
        # comma-separated line (for example key: 钥匙, 键, 关键). Treat each
        # item as its own semantic candidate before WordNet alignment.
        for part_index, part in enumerate(re.split(r"[;；,，、/]", raw_text)):
            meaning = clean_source_meaning(part)
            if not meaning or PERSON_RE.search(meaning):
                continue
            groups.append(
                {
                    "meaning": meaning,
                    "declaredPos": declared,
                    "sourceOrder": line_index * 100 + part_index,
                }
            )
    deduped = []
    seen = set()
    for group in groups:
        key = (normalize_zh(group["meaning"]), group.get("declaredPos"))
        if key[0] and key not in seen:
            seen.add(key)
            deduped.append(group)
    return deduped


def clean_zh_translation(text):
    value = str(text or "").replace("▁", " ").replace("_", " ").strip()
    value = re.sub(r"^\s*\([a-z]\)\s*", "", value, flags=re.I)
    value = re.sub(r"[；;。.]\s*$", "", value)
    value = re.sub(r"\s+", "", value)
    value = value.replace("+的", "的")
    return value


class LocalTranslator:
    def __init__(self, model_dir):
        if not (model_dir / "model").exists() or not (model_dir / "sentencepiece.model").exists():
            raise FileNotFoundError(f"Missing local Argos model: {model_dir}")
        self.processor = spm.SentencePieceProcessor(model_file=str(model_dir / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(str(model_dir / "model"), device="cpu")

    def translate_many(self, texts, batch_size=256):
        unique = list(dict.fromkeys(str(text or "").strip() for text in texts if str(text or "").strip()))
        result = {}
        for start in range(0, len(unique), batch_size):
            batch = unique[start : start + batch_size]
            encoded = [self.processor.encode(text, out_type=str) for text in batch]
            translated = self.translator.translate_batch(
                encoded,
                beam_size=1,
                num_hypotheses=1,
                replace_unknowns=True,
                max_batch_size=batch_size,
                batch_type="examples",
            )
            for text, item in zip(batch, translated):
                output = self.processor.decode(item.hypotheses[0]).replace("▁", " ").replace("_", " ").strip()
                result[text] = output
        return result


def english_tokens(text, excluded_word=""):
    excluded = re.sub(r"[^a-z]", "", excluded_word.lower())
    tokens = []
    for raw in re.findall(r"[a-z]+", str(text or "").lower()):
        token = raw
        for suffix in ("ing", "ed", "es", "s"):
            if token.endswith(suffix) and len(token) > len(suffix) + 2:
                token = token[: -len(suffix)]
                break
        if token not in STOP_WORDS and token != excluded and len(token) > 1:
            tokens.append(token)
    return set(tokens)


def lexical_score(query, candidate, word):
    left = english_tokens(query, word)
    right = english_tokens(candidate, word)
    if not left or not right:
        return 0.0
    return len(left & right) / math.sqrt(len(left) * len(right))


def dictionary_candidate_score(candidate, dictionary_entries, word):
    return max(
        (dictionary_entry_score(candidate, row, word) for row in dictionary_entries),
        default=0.0,
    )


def dictionary_entry_score(candidate, row, word):
    definition = candidate["definition"].lower()
    source_definition = row["definition"].lower()
    lexical = lexical_score(source_definition, definition, word)
    sequence = SequenceMatcher(None, source_definition, definition).ratio()
    return lexical + sequence * 0.35


def cow_score(meaning, lemmas):
    source_tokens = [normalize_zh(token) for token in re.split(r"[，、；;/]", meaning)]
    source_tokens = [token for token in source_tokens if token]
    best = 0.0
    for source in source_tokens:
        for raw_lemma in lemmas:
            lemma = normalize_zh(raw_lemma)
            if not lemma:
                continue
            if source == lemma:
                best = max(best, 1.0)
            elif source in lemma or lemma in source:
                best = max(best, 0.8)
            else:
                left = set(source)
                right = set(lemma)
                dice = 2 * len(left & right) / (len(left) + len(right)) if left or right else 0
                if dice >= 0.72:
                    best = max(best, dice * 0.65)
    return best


def candidate_text(candidate):
    synonyms = [lemma for lemma in candidate["lemmas"] if lemma.lower() != candidate["word"].lower()]
    examples = " ".join(candidate["examples"][:2])
    return f"{candidate['definition']}. Synonyms: {', '.join(synonyms)}. {examples}".strip()


def is_biographical(candidate):
    return bool(BIOGRAPHY_RE.search(candidate["definition"]))


def load_candidate_index(word_entries):
    db_path = Path(os.environ.get("WN_DB_PATH", str(Path.home() / ".wn_data" / "wn.db")))
    if not db_path.exists():
        raise FileNotFoundError(f"Missing local Wn database: {db_path}")
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    lexicons = {
        row["specifier"]: row["rowid"]
        for row in connection.execute("SELECT rowid, specifier FROM lexicons")
    }
    en_id = lexicons["omw-en:2.0"]
    zh_id = lexicons["omw-cmn:2.0"]

    connection.execute("CREATE TEMP TABLE target_words(word TEXT PRIMARY KEY, ord INTEGER)")
    connection.executemany(
        "INSERT OR IGNORE INTO target_words(word, ord) VALUES (?, ?)",
        [(entry["word"].lower(), index) for index, entry in enumerate(word_entries)],
    )

    zh_by_ili = defaultdict(list)
    for row in connection.execute(
        """
        SELECT i.id AS ili, f.form AS lemma
        FROM synsets s
        JOIN ilis i ON i.rowid = s.ili_rowid
        JOIN senses se ON se.synset_rowid = s.rowid
        JOIN entries e ON e.rowid = se.entry_rowid
        JOIN forms f ON f.entry_rowid = e.rowid AND f.rank = 0
        WHERE s.lexicon_rowid = ? AND e.lexicon_rowid = ?
        """,
        (zh_id, zh_id),
    ):
        zh_by_ili[row["ili"]].append(row["lemma"])

    rows = connection.execute(
        """
        WITH first_def AS (
          SELECT synset_rowid, MIN(rowid) AS definition_rowid
          FROM definitions
          WHERE lexicon_rowid = ?
          GROUP BY synset_rowid
        )
        SELECT tw.word, s.id, s.pos, i.id AS ili, d.definition,
               MIN(se.entry_rank) AS sense_rank
        FROM target_words tw
        JOIN forms f ON LOWER(f.form) = tw.word AND f.rank = 0
        JOIN entries e ON e.rowid = f.entry_rowid AND e.lexicon_rowid = ?
        JOIN senses se ON se.entry_rowid = e.rowid
        JOIN synsets s ON s.rowid = se.synset_rowid AND s.lexicon_rowid = ?
        LEFT JOIN ilis i ON i.rowid = s.ili_rowid
        LEFT JOIN first_def fd ON fd.synset_rowid = s.rowid
        LEFT JOIN definitions d ON d.rowid = fd.definition_rowid
        GROUP BY tw.word, s.rowid
        ORDER BY tw.ord, sense_rank, s.id
        """,
        (en_id, en_id, en_id),
    )
    candidates_by_word = defaultdict(list)
    for row in rows:
        if row["pos"] not in POS_FROM_WN or not row["definition"]:
            continue
        candidate = {
            "word": row["word"],
            "id": row["id"],
            "pos": POS_FROM_WN[row["pos"]],
            "definition": row["definition"],
            "examples": [],
            "lemmas": [],
            "zhLemmas": list(dict.fromkeys(zh_by_ili.get(row["ili"], []))),
            "index": len(candidates_by_word[row["word"]]),
        }
        if not is_biographical(candidate):
            candidates_by_word[row["word"]].append(candidate)
    connection.close()
    return candidates_by_word


def embed_all(texts):
    unique = list(dict.fromkeys(text for text in texts if text))
    if not unique:
        return {}
    model_file = EMBED_MODEL / "model_optimized.onnx"
    if not model_file.exists():
        print(
            f"Semantic embedding model is unavailable at {model_file}; "
            "continuing with POS, synset, lexical, and sequence checks.",
            flush=True,
        )
        return {}
    model = TextEmbedding(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        specific_model_path=str(EMBED_MODEL),
    )
    vectors = np.asarray(list(model.embed(unique, batch_size=256)), dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-8)
    return {text: vector for text, vector in zip(unique, vectors)}


def merge_meanings(meanings):
    output = []
    seen = set()
    for meaning in meanings:
        for token in re.split(r"[，、]", meaning):
            clean = token.strip()
            key = normalize_zh(clean)
            if clean and key and key not in seen:
                seen.add(key)
                output.append(clean)
    return "，".join(output)


def aligned_source_meaning(groups, zh_lemmas, pos):
    aligned = []
    normalized_lemmas = {normalize_zh(item) for item in zh_lemmas if normalize_zh(item)}
    for group in groups:
        for token in re.split(r"[，、/]", group["meaning"]):
            clean = token.strip()
            normalized = normalize_zh(clean)
            exact = normalized in normalized_lemmas
            noun_adverb_fix = pos == "n." and f"{normalized}地" in normalized_lemmas
            if clean and (exact or noun_adverb_fix):
                aligned.append(clean)
    return merge_meanings(aligned)


def normalize_definition(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def choose_dictionary_meaning(translated_definition, candidates, pos, vectors):
    translated_chars = set(normalize_zh(translated_definition)) - set("的一是在和或某个这那为以者人")
    ranked = []
    for meaning in candidates:
        for token in re.split(r"[，、,/]", meaning):
            clean = clean_source_meaning(token)
            chars = set(normalize_zh(clean)) - set("的一是在和或某个这那为以者人")
            overlap = len(chars & translated_chars)
            dice = 2 * overlap / (len(chars) + len(translated_chars)) if chars and translated_chars else 0
            grammar = 0.0
            if pos == "adj." and clean.endswith("的"):
                grammar = 0.04
            elif pos == "adv." and clean.endswith("地"):
                grammar = 0.04
            ranked.append((overlap, dice + grammar, -len(clean), clean))
    ranked.sort(reverse=True)
    if ranked and (ranked[0][0] >= 2 or ranked[0][1] >= 0.16):
        return ranked[0][3], "dictionary-guided-translation"
    semantic = []
    if translated_definition in vectors:
        for _, _, _, clean in ranked:
            if clean in vectors:
                semantic.append((float(np.dot(vectors[translated_definition], vectors[clean])), clean))
    semantic.sort(reverse=True)
    margin = semantic[0][0] - semantic[1][0] if len(semantic) > 1 else (semantic[0][0] if semantic else 0)
    if semantic and semantic[0][0] >= 0.55 and margin >= 0.035:
        return semantic[0][1], "dictionary-semantic-guided"
    return clean_zh_translation(translated_definition), "translated-dictionary-definition"


def definition_example(word, pos, definition):
    definition = re.sub(r"[.!?]+$", "", definition.strip())
    capitalized = word[:1].upper() + word[1:]
    if pos == "n.":
        if re.match(r"^(?:a|an|the)\b", definition, re.I):
            return clean_sentence(f"{capitalized} is {definition}")
        return clean_sentence(f"{capitalized} means {definition}")
    if pos == "v.":
        if re.match(r"^to\b", definition, re.I):
            return clean_sentence(f"{capitalized} means {definition}")
        return clean_sentence(f"To {word} means to {definition}")
    if pos == "adj.":
        return clean_sentence(f"Something described as {word} is {definition}")
    return clean_sentence(f"{capitalized} means {definition}")


def dictionary_example(word, pos, definition):
    if lexeme_pattern(word).search(definition):
        return clean_sentence(definition)
    return definition_example(word, pos, definition)


def manual_word(word_entry, override, source_label="manual-reviewed"):
    senses = []
    for index, sense in enumerate(override.get("senses", [])):
        senses.append(
            {
                "id": f"manual-{index + 1}",
                "pos": sense["pos"],
                "meaning": clean_source_meaning(sense["meaning"]),
                "example": clean_sentence(sense["example"]),
                "importance": max(1, 100 - index * 3),
                "exampleSource": source_label,
                "meaningSource": source_label,
                "auditStatus": "human-reviewed",
            }
        )
    return {"id": word_entry.get("id", word_entry["word"]), "word": word_entry["word"], "senses": senses}


def lexeme_pattern(word):
    escaped = re.escape(word)
    variants = [escaped, escaped + r"(?:s|es|ed|ing)"]
    if re.search(r"[bcdfghjklmnpqrstvwxyz]$", word, re.I):
        variants.append(escaped + re.escape(word[-1]) + r"(?:ed|ing)")
    if word.endswith("e"):
        variants.append(re.escape(word[:-1]) + r"(?:ed|ing)")
    if word.endswith("y"):
        variants.append(re.escape(word[:-1]) + r"(?:ies|ied)")
    return re.compile(r"(?:^|[^a-z])(?:" + "|".join(variants) + r")(?=$|[^a-z])", re.I)


def audit(words):
    issue_names = (
        "emptyExamples",
        "emptyMeanings",
        "placeholders",
        "personNameSenses",
        "missingTargetWord",
        "brokenSynsetEvidence",
        "brokenDictionaryEvidence",
        "unreviewedSenses",
        "duplicateExamples",
        "duplicateMeanings",
        "emptyWords",
    )
    issues = {name: [] for name in issue_names}
    provenance = Counter()
    total_senses = 0
    for word in words:
        examples = defaultdict(list)
        meanings = defaultdict(list)
        for sense in word["senses"]:
            total_senses += 1
            provenance[sense.get("auditStatus", "missing")] += 1
            example = str(sense.get("example", "")).strip()
            meaning = str(sense.get("meaning", "")).strip()
            if not example:
                issues["emptyExamples"].append({"word": word["word"], "sense": sense})
            if not meaning:
                issues["emptyMeanings"].append({"word": word["word"], "sense": sense})
            if PLACEHOLDER_RE.search(example):
                issues["placeholders"].append({"word": word["word"], "sense": sense})
            if PERSON_RE.search(meaning):
                issues["personNameSenses"].append({"word": word["word"], "sense": sense})
            if not lexeme_pattern(word["word"]).search(example):
                issues["missingTargetWord"].append({"word": word["word"], "sense": sense})
            if sense.get("auditStatus") == "synset-verified":
                definition = sense.get("definition", "")
                if not sense.get("synsetId") or definition.lower() not in example.lower():
                    issues["brokenSynsetEvidence"].append({"word": word["word"], "sense": sense})
            elif sense.get("auditStatus") == "dictionary-verified":
                definition = sense.get("definition", "")
                if not sense.get("dictionarySource") or definition.lower() not in example.lower():
                    issues["brokenDictionaryEvidence"].append({"word": word["word"], "sense": sense})
            elif sense.get("auditStatus") != "human-reviewed":
                issues["unreviewedSenses"].append({"word": word["word"], "sense": sense})
            examples[re.sub(r"\s+", " ", example.lower())].append(sense)
            meanings[(sense.get("pos"), normalize_zh(meaning))].append(sense)
        for example, senses in examples.items():
            if example and len(senses) > 1:
                issues["duplicateExamples"].append({"word": word["word"], "example": example, "senses": senses})
        for key, senses in meanings.items():
            if key[1] and len(senses) > 1:
                issues["duplicateMeanings"].append({"word": word["word"], "key": key, "senses": senses})
        if not word["senses"]:
            issues["emptyWords"].append(word["word"])
    return {
        "totalWords": len(words),
        "totalSenses": total_senses,
        "provenance": dict(provenance),
        "counts": {key: len(value) for key, value in issues.items()},
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--preview", default="")
    parser.add_argument("--words-path", type=Path, default=WORDS_PATH)
    parser.add_argument("--source-path", type=Path, default=SOURCE_PATH)
    parser.add_argument("--manual-path", type=Path, default=MANUAL_PATH)
    parser.add_argument("--function-path", type=Path, default=FUNCTION_PATH)
    parser.add_argument(
        "--dictionary-path",
        type=Path,
        default=DICTIONARY_FALLBACK_PATH,
    )
    parser.add_argument(
        "--translation-cache-path",
        type=Path,
        default=TRANSLATION_CACHE_PATH,
    )
    parser.add_argument(
        "--synset-corrections-path",
        type=Path,
        default=SYNSET_CORRECTIONS_PATH,
    )
    parser.add_argument("--backup-path", type=Path, default=BACKUP_PATH)
    parser.add_argument("--report-path", type=Path, default=REPORT_PATH)
    parser.add_argument(
        "--append-manual-words",
        action="store_true",
        help="Append manual override words that are absent from the input list.",
    )
    args = parser.parse_args()

    current_words = read_json(args.words_path)
    source_rows = read_json(args.source_path)
    manual_rows = read_json(args.manual_path)
    function_rows = read_json(args.function_path)
    dictionary_rows = read_json(args.dictionary_path)
    synset_corrections = read_json(args.synset_corrections_path)
    existing_definition_translations = (
        read_json(args.translation_cache_path)
        if args.translation_cache_path.exists()
        else {}
    )
    source_by_word = {}
    for row in source_rows:
        key = row["word"].lower()
        combined = source_by_word.setdefault(key, {"word": row["word"], "translations": []})
        combined["translations"].extend(row.get("translations", []))
    manual_by_word = {row["word"].lower(): row for row in manual_rows}
    function_by_word = {row["word"].lower(): row for row in function_rows}
    existing_words = {word["word"].lower() for word in current_words}
    if args.append_manual_words:
        for row in manual_rows:
            key = row["word"].lower()
            if not row.get("remove") and key not in existing_words:
                current_words.append({"id": key, "word": row["word"], "senses": []})
                existing_words.add(key)

    preview_words = {word.strip().lower() for word in args.preview.split(",") if word.strip()}
    if preview_words:
        current_words = [word for word in current_words if word["word"].lower() in preview_words]

    print("Loading bilingual WordNet index...", flush=True)
    candidates_by_word = load_candidate_index(current_words)

    word_work = []
    for word_entry in current_words:
        key = word_entry["word"].lower()
        manual = manual_by_word.get(key)
        function = function_by_word.get(key)
        if manual or (function and function.get("mode") == "replace"):
            word_work.append({"entry": word_entry, "manual": manual, "function": function})
            continue
        groups = source_groups(source_by_word.get(key, {}))
        candidates = candidates_by_word.get(key, [])
        word_work.append(
            {
                "entry": word_entry,
                "manual": None,
                "function": function,
                "groups": groups,
                "candidates": candidates,
            }
        )

    pending_words = []
    audit_words = []
    definitions_to_translate = []
    for work in word_work:
        word_entry = work["entry"]
        key = word_entry["word"].lower()
        manual = work.get("manual")
        function = work.get("function")
        if manual:
            if manual.get("remove"):
                continue
            pending_words.append({"entry": manual_word(word_entry, manual), "audit": {"word": word_entry["word"], "mode": "manual"}})
            continue
        if function and function.get("mode") == "replace":
            pending_words.append(
                {
                    "entry": manual_word(word_entry, function, "manual-function"),
                    "audit": {"word": word_entry["word"], "mode": "function-replace"},
                }
            )
            continue

        groups = work.get("groups", [])
        candidates = work.get("candidates", [])
        pair_rows = []
        for group_index, group in enumerate(groups):
            ranked = []
            for candidate_index, candidate in enumerate(candidates):
                if group.get("declaredPos") in STANDARD_POS and group["declaredPos"] != candidate["pos"]:
                    continue
                cow = cow_score(group["meaning"], candidate["zhLemmas"])
                pos_boost = 0.18 if group.get("declaredPos") == candidate["pos"] else 0.0
                score = cow * 1.8 + pos_boost - candidate["index"] * 0.002
                ranked.append(
                    {
                        "candidateIndex": candidate_index,
                        "score": score,
                        "similarity": 0.0,
                        "cow": cow,
                        "lexical": 0.0,
                    }
                )
            ranked.sort(key=lambda item: item["score"], reverse=True)
            top = ranked[0] if ranked else None
            margin = top["score"] - ranked[1]["score"] if len(ranked) > 1 else (top["score"] if top else 0)
            strong = bool(top and top["cow"] >= 0.78)
            pair_rows.append({"groupIndex": group_index, "ranked": ranked, "top": top, "margin": margin, "strong": strong})

        selected = {}
        group_audit = []
        for pair in sorted(
            pair_rows,
            key=lambda item: (
                item["top"]["cow"] if item["top"] else 0,
                item["margin"],
                item["top"]["similarity"] if item["top"] else 0,
            ),
            reverse=True,
        ):
            group = groups[pair["groupIndex"]]
            top = pair["top"]
            matched_id = None
            if pair["strong"] and top:
                candidate = candidates[top["candidateIndex"]]
                if candidate["zhLemmas"]:
                    matched_id = candidate["id"]
                    selected.setdefault(candidate["id"], {"candidate": candidate, "groups": []})["groups"].append(group)
            group_audit.append(
                {
                    "meaning": group["meaning"],
                    "declaredPos": group.get("declaredPos"),
                    "english": None,
                    "strongMatch": bool(matched_id),
                    "matchedSynset": matched_id,
                    "score": round(top["score"], 4) if top else None,
                    "similarity": round(top["similarity"], 4) if top else None,
                    "cowScore": round(top["cow"], 4) if top else None,
                    "margin": round(pair["margin"], 4),
                }
            )

        # ECDICT's English definitions are ordered, high-frequency dictionary
        # senses and are frequently verbatim WordNet glosses. Chinese Open
        # WordNet can map homographic translations such as "关键" to the
        # physical-key synset, so retain every exact/near-exact dictionary
        # definition match as an independent sense as well.
        for source_entry in dictionary_rows.get(key, []):
            options = [
                candidate
                for candidate in candidates
                if candidate["pos"] == source_entry.get("pos")
            ]
            if not options:
                continue
            ranked_options = [
                (
                    dictionary_entry_score(
                        candidate,
                        source_entry,
                        word_entry["word"],
                    ),
                    candidate,
                )
                for candidate in options
            ]
            best_score, best_candidate = max(
                ranked_options,
                key=lambda item: (item[0], -item[1]["index"]),
            )
            if best_score < 0.78:
                continue
            translated_definition = existing_definition_translations.get(
                best_candidate["definition"],
                "",
            )
            source_meanings = [
                group["meaning"]
                for group in groups
                if (
                    not group.get("declaredPos")
                    or group["declaredPos"] == best_candidate["pos"]
                )
            ]
            aligned_meaning, alignment_source = choose_dictionary_meaning(
                translated_definition,
                source_meanings,
                best_candidate["pos"],
                {},
            )
            if not alignment_source.startswith("dictionary-"):
                continue
            if best_candidate["id"] in selected:
                continue
            candidate = dict(best_candidate)
            candidate["dictionaryMeanings"] = [aligned_meaning]
            candidate["dictionarySources"] = [source_entry["source"]]
            candidate["dictionaryDefinitionMatch"] = True
            selected[candidate["id"]] = {"candidate": candidate, "groups": []}

        # Never pad a word with weakly matched synsets merely to preserve the old
        # sense count. When Chinese WordNet cannot confirm a source group, keep at
        # most the first English WordNet sense for each source POS. Dictionary
        # Chinese text is a meaning hint only; it never supplies POS or definition.
        # If the English dictionary wording is too different for a lexical match,
        # retain one exact-word, same-POS WordNet candidate and translate that
        # candidate's own definition. This preserves semantic alignment without
        # reusing an uncertain legacy Chinese gloss.
        if not selected and candidates:
            desired_positions = []
            for group in groups:
                if group.get("declaredPos") in STANDARD_POS and group["declaredPos"] not in desired_positions:
                    desired_positions.append(group["declaredPos"])
            for row in dictionary_rows.get(key, []):
                if row["pos"] in STANDARD_POS and row["pos"] not in desired_positions:
                    desired_positions.append(row["pos"])
            if not desired_positions:
                desired_positions = [candidates[0]["pos"]]
            for pos in desired_positions:
                options = [candidate for candidate in candidates if candidate["pos"] == pos]
                if not options:
                    continue
                source_entries = [row for row in dictionary_rows.get(key, []) if row["pos"] == pos]
                if not source_entries:
                    continue
                ranked_options = [
                    (dictionary_candidate_score(candidate, source_entries, word_entry["word"]), candidate)
                    for candidate in options
                ]
                ranked_options.sort(key=lambda item: (item[0], -item[1]["index"]), reverse=True)
                best_score, best_candidate = ranked_options[0]
                candidate = dict(best_candidate)
                matched_entries = [
                    row
                    for row in source_entries
                    if dictionary_entry_score(candidate, row, word_entry["word"]) >= max(0.18, best_score - 0.08)
                ]
                candidate["dictionaryMeanings"] = [row["meaning"] for row in matched_entries]
                candidate["dictionarySources"] = [row["source"] for row in matched_entries]
                candidate["synsetBackedFallback"] = True
                selected[candidate["id"]] = {"candidate": candidate, "groups": []}

        # A true no-WordNet entry is retained from the source dictionary so the
        # audit can list it explicitly; these should normally be manual overrides.
        if not selected and not candidates:
            dictionary_groups = {}
            for row in dictionary_rows.get(key, []):
                group_key = (row["pos"], normalize_definition(row["definition"]))
                group = dictionary_groups.setdefault(
                    group_key,
                    {"pos": row["pos"], "definition": row["definition"], "meanings": [], "sources": []},
                )
                if not PERSON_RE.search(row["meaning"]) and not BIOGRAPHY_RE.search(row["definition"]):
                    group["meanings"].append(row["meaning"])
                    group["sources"].append(row["source"])
            for dictionary_index, row in enumerate(dictionary_groups.values()):
                if not row["meanings"]:
                    continue
                candidate = {
                    "word": word_entry["word"],
                    "id": f"dictionary-{dictionary_index + 1}",
                    "pos": row["pos"],
                    "definition": row["definition"],
                    "examples": [],
                    "lemmas": [],
                    "zhLemmas": [],
                    "index": dictionary_index,
                    "dictionaryMeanings": row["meanings"],
                    "dictionarySources": row["sources"],
                }
                selected[candidate["id"]] = {"candidate": candidate, "groups": []}

        pending_senses = []
        for item in selected.values():
            candidate = item["candidate"]
            matched_groups = item["groups"]
            if not candidate["zhLemmas"]:
                definitions_to_translate.append(candidate["definition"])
            order = min((group["sourceOrder"] for group in matched_groups), default=10000 + candidate["index"])
            pending_senses.append({"candidate": candidate, "groups": matched_groups, "order": order})
        pending_senses.sort(key=lambda item: (item["order"], item["candidate"]["index"]))
        pending_words.append(
            {
                "entry": {"id": word_entry.get("id", word_entry["word"]), "word": word_entry["word"], "senses": pending_senses},
                "function": function,
                "audit": {"word": word_entry["word"], "mode": "synset", "sourceGroups": group_audit},
            }
        )

    translation_cache = (
        read_json(args.translation_cache_path)
        if args.translation_cache_path.exists()
        else {}
    )
    missing_definitions = [
        definition
        for definition in dict.fromkeys(definitions_to_translate)
        if definition not in translation_cache
    ]
    print(
        f"Definition translations: {len(definitions_to_translate)} requested, "
        f"{len(missing_definitions)} missing from cache.",
        flush=True,
    )
    if missing_definitions:
        en_zh = LocalTranslator(EN_ZH_MODEL)
        for start in range(0, len(missing_definitions), 32):
            batch = missing_definitions[start : start + 32]
            translation_cache.update(en_zh.translate_many(batch, batch_size=32))
            write_json(args.translation_cache_path, translation_cache)
            print(f"Cached {min(start + len(batch), len(missing_definitions))}/{len(missing_definitions)} translations.", flush=True)
    en_zh_map = translation_cache

    dictionary_embedding_texts = []
    for pending in pending_words:
        if pending["audit"]["mode"] in {"manual", "function-replace"}:
            continue
        for item in pending["entry"]["senses"]:
            candidate = item["candidate"]
            if not candidate.get("dictionaryMeanings"):
                continue
            dictionary_embedding_texts.append(en_zh_map.get(candidate["definition"], ""))
            for meaning in candidate["dictionaryMeanings"]:
                dictionary_embedding_texts.extend(
                    clean_source_meaning(token)
                    for token in re.split(r"[，、,/]", meaning)
                    if clean_source_meaning(token)
                )
    print(f"Embedding {len(set(dictionary_embedding_texts))} dictionary audit texts...", flush=True)
    dictionary_vectors = embed_all(dictionary_embedding_texts)

    rebuilt = []
    for pending in pending_words:
        entry = pending["entry"]
        if pending["audit"]["mode"] in {"manual", "function-replace"}:
            rebuilt.append(entry)
            audit_words.append(pending["audit"])
            continue
        senses = []
        for item in entry["senses"]:
            candidate = item["candidate"]
            if candidate.get("dictionaryMeanings") and not candidate["zhLemmas"]:
                translated = en_zh_map.get(candidate["definition"], "")
                meaning, meaning_source = choose_dictionary_meaning(
                    translated,
                    candidate["dictionaryMeanings"],
                    candidate["pos"],
                    dictionary_vectors,
                )
                if candidate.get("synsetBackedFallback"):
                    if meaning_source == "translated-dictionary-definition":
                        meaning_source = "translated-synset-definition"
                    example_source = "wordnet-definition"
                    audit_status = "synset-verified"
                else:
                    example_source = "dictionary-definition"
                    audit_status = "dictionary-verified"
            else:
                meaning = aligned_source_meaning(item["groups"], candidate["zhLemmas"], candidate["pos"])
                if meaning:
                    meaning_source = "source-cow-synset-match"
                else:
                    meaning = merge_meanings(clean_zh_translation(item) for item in candidate["zhLemmas"])
                    if meaning:
                        meaning_source = "cow-synset-lemmas"
                    else:
                        meaning = clean_zh_translation(en_zh_map.get(candidate["definition"], "")) or candidate["definition"]
                        meaning_source = "translated-synset-definition"
                example_source = "wordnet-definition"
                audit_status = "synset-verified"
            corrected_meaning = synset_corrections.get(candidate["id"])
            if corrected_meaning:
                meaning = corrected_meaning
                meaning_source = "human-reviewed-synset-translation"
            sense = {
                "pos": candidate["pos"],
                "meaning": meaning,
                "example": (
                    dictionary_example(entry["word"], candidate["pos"], candidate["definition"])
                    if audit_status == "dictionary-verified"
                    else definition_example(entry["word"], candidate["pos"], candidate["definition"])
                ),
                "exampleSource": example_source,
                "meaningSource": meaning_source,
                "auditStatus": audit_status,
                "definition": candidate["definition"],
            }
            if audit_status == "synset-verified":
                sense["synsetId"] = candidate["id"]
                if candidate.get("dictionaryMeanings"):
                    sense["dictionarySources"] = candidate.get("dictionarySources", [])
                    sense["dictionaryCandidates"] = candidate["dictionaryMeanings"]
            else:
                sense["dictionarySource"] = candidate["dictionarySources"][0]
                sense["dictionarySources"] = candidate["dictionarySources"]
                sense["dictionaryCandidates"] = candidate["dictionaryMeanings"]
            senses.append(sense)
        function = pending.get("function")
        if function:
            for sense in function.get("senses", []):
                senses.append(
                    {
                        "pos": sense["pos"],
                        "meaning": clean_source_meaning(sense["meaning"]),
                        "example": clean_sentence(sense["example"]),
                        "exampleSource": "manual-function",
                        "meaningSource": "manual-function",
                        "auditStatus": "human-reviewed",
                    }
                )
        deduped = []
        seen_examples = set()
        seen_synsets = set()
        seen_meanings = set()
        for sense in senses:
            example_key = re.sub(r"\s+", " ", sense["example"].lower())
            synset_key = sense.get("synsetId")
            meaning_key = (sense["pos"], normalize_zh(sense["meaning"]))
            if (
                example_key in seen_examples
                or (synset_key and synset_key in seen_synsets)
                or (meaning_key[1] and meaning_key in seen_meanings)
            ):
                continue
            seen_examples.add(example_key)
            seen_meanings.add(meaning_key)
            if synset_key:
                seen_synsets.add(synset_key)
            deduped.append(sense)
        for index, sense in enumerate(deduped):
            sense["id"] = f"sense-{index + 1}"
            sense["importance"] = max(1, 100 - index * 3)
        entry["senses"] = deduped
        rebuilt.append(entry)
        audit_words.append(pending["audit"])

    quality = audit(rebuilt)
    report = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "method": {
            "standardSenses": "Same Open Multilingual WordNet synset supplies POS, English definition, and example.",
            "meaning": "Every standard Chinese label is limited to source tokens confirmed by Chinese Open Wordnet on the same ILI, otherwise the same-synset Chinese lemmas are used; local definition translation is only a final fallback.",
            "selection": "Only exact or containment matches against same-POS Chinese Open Wordnet lemmas may select additional senses; low-confidence source groups are removed.",
            "dictionaryFallback": "When bilingual WordNet cannot confirm any sense, the source dictionary definition is translated locally and may be shortened only to a Chinese candidate sharing explicit character clues with that translation.",
            "functionWords": "Function-word and abbreviation senses are stored in a separate human-reviewed override file.",
            "externalApiCalls": 0,
        },
        "summary": {
            "wordsBefore": len(current_words),
            "wordsAfter": len(rebuilt),
            "sensesBefore": sum(len(word.get("senses", [])) for word in current_words),
            "sensesAfter": sum(len(word.get("senses", [])) for word in rebuilt),
            "sourceGroupsAudited": sum(len(item.get("sourceGroups", [])) for item in audit_words),
            "strongSourceMatches": sum(
                1 for item in audit_words for group in item.get("sourceGroups", []) if group.get("strongMatch")
            ),
            "unmatchedSourceGroupsRemoved": sum(
                1 for item in audit_words for group in item.get("sourceGroups", []) if not group.get("strongMatch")
            ),
            "qualityIssueCounts": quality["counts"],
            "provenance": quality["provenance"],
        },
        "quality": quality,
        "words": audit_words,
    }

    if args.preview:
        print(
            json.dumps(
                {
                    "summary": report["summary"],
                    "words": rebuilt,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    if not args.dry_run:
        if not args.backup_path.exists():
            shutil.copy2(args.words_path, args.backup_path)
        write_json(args.words_path, rebuilt)
        write_json(args.report_path, report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Semantic rebuild failed: {error}", file=sys.stderr)
        raise
