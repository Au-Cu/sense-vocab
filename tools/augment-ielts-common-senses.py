import json
import math
import os
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import ctranslate2
import numpy as np
import sentencepiece as spm
from fastembed import TextEmbedding


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WORDS_PATH = DATA_DIR / "ielts-new-words.json"
SOURCE_PATH = DATA_DIR / "ielts-source.json"
DICTIONARY_PATH = DATA_DIR / "ielts-dictionary-definition-fallbacks.json"
KAIKKI_PATH = DATA_DIR / "ielts-kaikki-cache.json"
CACHE_PATH = DATA_DIR / "ielts-kaikki-gloss-translation-cache.json"
REPORT_PATH = DATA_DIR / "ielts-common-sense-augmentation-audit.json"
MODEL_DIR = Path(r"D:\Files\argos-en-zh-audit")
EMBED_MODEL = Path(
    os.environ.get(
        "SEMANTIC_EMBED_MODEL_DIR",
        str(
            Path(os.environ.get("TEMP", "."))
            / "paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"
        ),
    )
)

STANDARD_POS = {"n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "num.", "int."}
EXCLUDED_TAGS = {
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
    "uncommon",
}
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "for",
    "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
    "that", "the", "their", "this", "to", "was", "were", "which", "while", "with",
}


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_english(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def english_tokens(value):
    return {
        token
        for token in normalize_english(value).split()
        if len(token) > 1 and token not in STOP_WORDS
    }


def lexical_score(left, right):
    a = english_tokens(left)
    b = english_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / math.sqrt(len(a) * len(b))


def definition_similarity(left, right):
    return max(
        lexical_score(left, right),
        SequenceMatcher(None, normalize_english(left), normalize_english(right)).ratio()
        * 0.55,
    )


def normalize_chinese(value):
    return "".join(re.findall(r"[\u3400-\u9fff]", str(value or "")))


def clean_label(value):
    text = str(value or "").replace("▁", " ").replace("_", " ")
    text = re.sub(r"^\s*(?:n|v|adj|adv|prep|conj|pron|num|int)\s*\.\s*", "", text, flags=re.I)
    text = re.sub(r"\s+", "", text)
    text = text.strip("，。；、,:：;()（）[]【】")
    return text


def label_parts(value):
    result = []
    for part in re.split(r"[,，;；/、]", str(value or "")):
        clean = clean_label(part)
        if not clean or len(normalize_chinese(clean)) > 24:
            continue
        if re.search(r"人名|姓氏|（.*复数.*）", clean):
            continue
        result.append(clean)
    return result


def clean_translation(value):
    text = clean_label(value)
    text = re.sub(r"([，。！？；：])\1+", r"\1", text)
    return text


class LocalTranslator:
    def __init__(self):
        self.processor = spm.SentencePieceProcessor(
            model_file=str(MODEL_DIR / "sentencepiece.model"),
        )
        self.translator = ctranslate2.Translator(str(MODEL_DIR / "model"), device="cpu")

    def translate_many(self, texts, batch_size=64):
        encoded = [self.processor.encode(text, out_type=str) for text in texts]
        output = self.translator.translate_batch(
            encoded,
            beam_size=1,
            num_hypotheses=1,
            replace_unknowns=True,
            max_batch_size=batch_size,
            batch_type="examples",
        )
        return [
            clean_translation(self.processor.decode(item.hypotheses[0]))
            for item in output
        ]


def translate_required(values, cache):
    missing = [value for value in dict.fromkeys(values) if value and not cache.get(value)]
    if not missing:
        return
    translator = LocalTranslator()
    for start in range(0, len(missing), 64):
        batch = missing[start : start + 64]
        cache.update(zip(batch, translator.translate_many(batch)))
        write_json(CACHE_PATH, cache)
        print(
            f"gloss translations {min(start + len(batch), len(missing))}/{len(missing)}",
            flush=True,
        )


def build_vectors(texts):
    unique = list(dict.fromkeys(text for text in texts if text))
    if not unique:
        return {}
    model_file = EMBED_MODEL / "model_optimized.onnx"
    if not model_file.exists():
        return {}
    model = TextEmbedding(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        specific_model_path=str(EMBED_MODEL),
    )
    vectors = np.asarray(list(model.embed(unique, batch_size=256)), dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-8)
    return {text: vector for text, vector in zip(unique, vectors)}


def candidate_label(translated, labels, vectors):
    translated = clean_translation(translated)
    if not labels:
        return translated, "argos-en-zh-local", 0.0
    translated_chars = set(normalize_chinese(translated)) - set("的一是在和或某个这那为以者人")
    ranked = []
    for label in labels:
        chars = set(normalize_chinese(label)) - set("的一是在和或某个这那为以者人")
        overlap = len(chars & translated_chars)
        dice = 2 * overlap / (len(chars) + len(translated_chars)) if chars and translated_chars else 0
        semantic = (
            float(np.dot(vectors[translated], vectors[label]))
            if translated in vectors and label in vectors
            else 0.0
        )
        ranked.append((max(dice, semantic), overlap, -len(label), label))
    ranked.sort(reverse=True)
    score, overlap, _, label = ranked[0]
    if overlap >= 2 or score >= 0.46:
        return label, "ecdict-semantic-match", round(score, 4)
    return translated, "argos-en-zh-local", round(score, 4)


def flattened_kaikki(cache_entry):
    by_pos = defaultdict(list)
    position = defaultdict(int)
    for entry in cache_entry.get("entries", []):
        pos = entry.get("pos", "")
        if pos not in STANDARD_POS:
            continue
        for sense in entry.get("senses", []):
            tags = {str(tag).lower() for tag in sense.get("tags", [])}
            if tags & EXCLUDED_TAGS:
                continue
            definition = next(
                (item for item in reversed(sense.get("glosses", [])) if item),
                "",
            )
            if not definition:
                continue
            by_pos[pos].append({
                "pos": pos,
                "definition": definition,
                "tags": sorted(tags),
                "order": position[pos],
                "entry": entry,
            })
            position[pos] += 1
    return by_pos


def main():
    words = read_json(WORDS_PATH, [])
    source_rows = read_json(SOURCE_PATH, [])
    dictionary = read_json(DICTIONARY_PATH, {})
    kaikki = read_json(KAIKKI_PATH, {})
    cache = read_json(CACHE_PATH, {})
    source_by_word = {row["word"]: row for row in source_rows}

    planned = []
    for word in words:
        source = source_by_word.get(word["word"], {})
        source_labels = defaultdict(list)
        untyped_labels = []
        for row in source.get("translations", []):
            parts = label_parts(row.get("translation", ""))
            if row.get("type") in STANDARD_POS:
                source_labels[row["type"]].extend(parts)
            else:
                untyped_labels.extend(parts)
        dictionary_by_pos = defaultdict(list)
        for row in dictionary.get(word["word"], []):
            if row.get("pos") in STANDARD_POS and not re.search(
                r"\b(?:born|died)\b|\b\d{4}\s*[-–]\s*\d{2,4}\b",
                row.get("definition", ""),
                re.I,
            ):
                dictionary_by_pos[row["pos"]].append(row)
                source_labels[row["pos"]].extend(label_parts(row.get("meaning", "")))

        current_by_pos = defaultdict(list)
        for sense in word.get("senses", []):
            current_by_pos[sense.get("pos", "")].append(sense)
        allowed_positions = set(dictionary_by_pos) | set(source_labels) | set(current_by_pos)
        candidates_by_pos = flattened_kaikki(kaikki.get(word["word"], {}))

        for pos in sorted(allowed_positions):
            if pos not in STANDARD_POS:
                continue
            candidates = []
            for candidate in candidates_by_pos.get(pos, []):
                dictionary_match = max(
                    (
                        definition_similarity(candidate["definition"], row["definition"])
                        for row in dictionary_by_pos.get(pos, [])
                    ),
                    default=0.0,
                )
                current_match = max(
                    (
                        definition_similarity(candidate["definition"], sense.get("definition", ""))
                        for sense in current_by_pos.get(pos, [])
                    ),
                    default=0.0,
                )
                candidate["dictionaryMatch"] = dictionary_match
                candidate["currentMatch"] = current_match
                if current_match >= 0.34:
                    continue
                if candidate["order"] < 2 or dictionary_match >= 0.19:
                    candidates.append(candidate)
            candidates.sort(
                key=lambda row: (
                    row["dictionaryMatch"],
                    -row["order"],
                    bool(row["entry"].get("sounds")),
                ),
                reverse=True,
            )
            target = min(
                4,
                max(
                    2,
                    len(dictionary_by_pos.get(pos, [])),
                ),
            )
            additions_needed = max(0, target - len(current_by_pos.get(pos, [])))
            selected = candidates[:additions_needed]
            for candidate in candidates[additions_needed:]:
                if candidate["dictionaryMatch"] >= 0.28:
                    selected.append(candidate)
            planned.extend({
                "word": word,
                "candidate": candidate,
                "labels": list(dict.fromkeys(
                    source_labels.get(pos, []) + untyped_labels,
                )),
            } for candidate in selected[:4])

    translate_required(
        [item["candidate"]["definition"] for item in planned],
        cache,
    )
    vector_texts = []
    for item in planned:
        translated = cache.get(item["candidate"]["definition"], "")
        vector_texts.append(translated)
        vector_texts.extend(item["labels"])
    vectors = build_vectors(vector_texts)

    added = []
    for item in planned:
        word = item["word"]
        candidate = item["candidate"]
        translated = cache.get(candidate["definition"], "")
        meaning, meaning_source, meaning_score = candidate_label(
            translated,
            item["labels"],
            vectors,
        )
        sounds = candidate["entry"].get("sounds", [])
        word["senses"].append({
            "id": f"kaikki-common-{len(word['senses']) + 1}",
            "pos": candidate["pos"],
            "meaning": meaning,
            "definition": candidate["definition"],
            "definitionSentence": candidate["definition"],
            "definitionZh": translated,
            "definitionSource": "kaikki-wiktionary",
            "definitionZhSource": "argos-en-zh-local",
            "meaningSource": meaning_source,
            "meaningMatchScore": meaning_score,
            "example": "",
            "exampleZh": "",
            "exampleSource": "",
            "auditStatus": "kaikki-common-sense",
            "ipa": next(
                (sound.get("ipa") for sound in sounds if sound.get("ipa")),
                "",
            ),
            "audio": next(
                (sound.get("audio") for sound in sounds if sound.get("audio")),
                "",
            ),
            "importance": max(1, 100 - len(word["senses"]) * 3),
        })
        added.append({
            "word": word["word"],
            "pos": candidate["pos"],
            "meaning": meaning,
            "definition": candidate["definition"],
            "meaningSource": meaning_source,
            "meaningMatchScore": meaning_score,
            "dictionaryMatch": round(candidate["dictionaryMatch"], 4),
        })

    for word in words:
        deduped = []
        for sense in word.get("senses", []):
            duplicate = next(
                (
                    previous
                    for previous in deduped
                    if previous.get("pos") == sense.get("pos")
                    and (
                        definition_similarity(
                            previous.get("definition", ""),
                            sense.get("definition", ""),
                        )
                        >= 0.55
                        or (
                            normalize_chinese(previous.get("meaning", ""))
                            == normalize_chinese(sense.get("meaning", ""))
                            and definition_similarity(
                                previous.get("definition", ""),
                                sense.get("definition", ""),
                            )
                            >= 0.2
                        )
                    )
                ),
                None,
            )
            if duplicate:
                for field in ("example", "exampleZh", "exampleSource", "ipa", "audio"):
                    if not duplicate.get(field) and sense.get(field):
                        duplicate[field] = sense[field]
                continue
            deduped.append(sense)
        for index, sense in enumerate(deduped):
            sense["id"] = f"sense-{index + 1}"
            sense["importance"] = max(1, 100 - index * 3)
        word["senses"] = deduped

    report = {
        "words": len(words),
        "senses": sum(len(word.get("senses", [])) for word in words),
        "addedBeforeDeduplication": len(added),
        "added": added,
        "meaningSources": {
            source: sum(row["meaningSource"] == source for row in added)
            for source in sorted({row["meaningSource"] for row in added})
        },
    }
    write_json(WORDS_PATH, words)
    write_json(REPORT_PATH, report)
    print(json.dumps({
        "words": report["words"],
        "senses": report["senses"],
        "addedBeforeDeduplication": report["addedBeforeDeduplication"],
        "meaningSources": report["meaningSources"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
