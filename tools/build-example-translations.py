import argparse
import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import ctranslate2
import sentencepiece as spm


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
CACHE_PATH = ROOT / "data" / "example-translation-cache.json"
DEFINITION_CACHE_PATH = ROOT / "data" / "definition-translation-cache.json"
REPORT_PATH = ROOT / "data" / "example-translation-audit.json"
OVERRIDES_PATH = ROOT / "data" / "example-translation-overrides.json"
DEFINITION_OVERRIDES_PATH = ROOT / "data" / "definition-example-translation-overrides.json"
MODEL_DIR = Path(os.environ.get("ARGOS_EN_ZH_MODEL_DIR", r"D:\Files\argos-en-zh-audit"))

SOURCE_DEFINITION = "wordnet-definition"
TRANSLATION_MODEL = "argos-en-zh-local"
BAD_TEXT_RE = re.compile(
    r"helpful sentence|needs clue|points to a specific meaning|generic sentence|"
    r"in this context|became important in the discussion|"
    r"they decided to \w+ before the meeting ended",
    re.I,
)


def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_zh_sentence(value):
    text = str(value or "").replace("▁", " ").replace("_", " ").strip()
    text = text.replace("，.", "。").replace("。.", "。").replace("?.", "？")
    text = re.sub(r"\s+([，。！？；：])", r"\1", text)
    text = re.sub(r"([，。！？；：])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace(",", "，").replace(";", "；")
    text = re.sub(r"\.(?=$)", "。", text)
    text = re.sub(r"\?(?=$)", "？", text)
    text = re.sub(r"!(?=$)", "！", text)
    text = re.sub(r"([，。！？；：])\1+", r"\1", text)
    return text.strip()


def without_terminal_punctuation(value):
    return re.sub(r"[。！？；，、:：.!?;]+$", "", clean_zh_sentence(value)).strip()


def display_meaning(value):
    text = clean_zh_sentence(value)
    text = text.replace(",", "、").replace("，", "、").replace(";", "；")
    return without_terminal_punctuation(text)


def cjk_text(value):
    return "".join(re.findall(r"[\u3400-\u9fff]", str(value or "")))


def collapse_translation_repetitions(value):
    text = clean_zh_sentence(value)
    for _ in range(6):
        previous = text
        text = re.sub(r"([\u3400-\u9fff]{2,24})(?:[，；、 ]+\1){1,}", r"\1", text)
        text = re.sub(r"([\u3400-\u9fff]{1,12})或\1", r"\1", text)
        text = re.sub(r"(.{2,16}?)(?:\1){2,}", r"\1", text)
        if text == previous:
            break
    return clean_zh_sentence(text)


def trustworthy_definition_translation(source, translation):
    translation = collapse_translation_repetitions(translation)
    chinese_length = len(cjk_text(translation))
    latin_terms = re.findall(r"[A-Za-z]{3,}", translation)
    if chinese_length < 2 or latin_terms:
        return ""
    if chinese_length > 80 or translation.count("；") > 3:
        return ""
    if re.search(r"(.{2,20})(?:[，；、 ]*\1){2,}", translation):
        return ""
    compact = cjk_text(translation)
    for width in range(3, 9):
        if any(compact.count(compact[start : start + width]) >= 3 for start in range(len(compact) - width + 1)):
            return ""
    return translation


class LocalTranslator:
    def __init__(self, model_dir):
        if not (model_dir / "model").exists() or not (model_dir / "sentencepiece.model").exists():
            raise FileNotFoundError(f"Missing local Argos model: {model_dir}")
        self.processor = spm.SentencePieceProcessor(model_file=str(model_dir / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(str(model_dir / "model"), device="cpu")

    def translate_many(self, texts, batch_size=64):
        encoded = [self.processor.encode(text, out_type=str) for text in texts]
        translated = self.translator.translate_batch(
            encoded,
            beam_size=1,
            num_hypotheses=1,
            replace_unknowns=True,
            max_batch_size=batch_size,
            batch_type="examples",
        )
        return [
            clean_zh_sentence(self.processor.decode(item.hypotheses[0]))
            for item in translated
        ]


def translate_missing(cache, section, texts, translator, batch_size, offline):
    unique = list(dict.fromkeys(str(text).strip() for text in texts if str(text).strip()))
    missing = [text for text in unique if not cache[section].get(text)]
    print(f"{section}: {len(unique)} unique, {len(missing)} missing", flush=True)
    if missing and offline:
        raise RuntimeError(f"Offline mode cannot fill {len(missing)} missing {section} translations")

    for start in range(0, len(missing), batch_size):
        batch = missing[start : start + batch_size]
        outputs = translator.translate_many(batch, batch_size=batch_size)
        cache[section].update(dict(zip(batch, outputs)))
        write_json(CACHE_PATH, cache)
        done = min(start + len(batch), len(missing))
        print(f"{section}: translated {done}/{len(missing)}", flush=True)


def compose_definition_translation(word, sense, translated_definition):
    meaning = display_meaning(sense.get("meaning", ""))
    definition = without_terminal_punctuation(
        trustworthy_definition_translation(sense.get("definition", ""), translated_definition)
    )
    relation = "指" if sense.get("pos") == "n." else "意为"
    if not definition or cjk_text(definition) in cjk_text(meaning) or cjk_text(meaning) in cjk_text(definition):
        return f"“{word}”在此处{relation}“{meaning}”。"
    return f"“{word}”在此处{relation}“{meaning}”，即{definition}。"


def compose_context_translation(word_entry, sense, translated_example, override=""):
    meaning = display_meaning(sense.get("meaning", ""))
    body = clean_zh_sentence(override) if override else collapse_translation_repetitions(translated_example)
    body = body if re.search(r"[。！？]$", body) else f"{body}。"
    return f"本句中“{word_entry['word']}”表示“{meaning}”：{body}"


def audit(words):
    blocking = defaultdict(list)
    review = defaultdict(list)
    counts = Counter()

    for word_entry in words:
        seen_examples = set()
        seen_example_translations = set()
        for sense in word_entry.get("senses", []):
            counts["senses"] += 1
            identity = {"word": word_entry["word"], "sense": sense.get("id")}
            definition = str(sense.get("definitionSentence", "")).strip()
            definition_zh = str(sense.get("definitionZh", "")).strip()
            example = str(sense.get("example", "")).strip()
            example_zh = str(sense.get("exampleZh", "")).strip()

            for name, value in (("definition", definition), ("example", example)):
                if not value:
                    blocking[f"missing{name.capitalize()}s"].append(identity)
                elif BAD_TEXT_RE.search(value) or "???" in value:
                    blocking[f"{name}Placeholders"].append({**identity, name: value})
            for name, value in (("definition", definition_zh), ("example", example_zh)):
                if not value:
                    blocking[f"missing{name.capitalize()}Translations"].append(identity)
                elif len(cjk_text(value)) < 2:
                    blocking[f"{name}TranslationsWithoutChinese"].append(
                        {**identity, "translation": value}
                    )
                elif BAD_TEXT_RE.search(value) or "???" in value:
                    blocking[f"{name}TranslationPlaceholders"].append(
                        {**identity, "translation": value}
                    )

            normalized_definition = re.sub(r"[^a-z0-9]+", "", definition.lower())
            normalized_example = re.sub(r"[^a-z0-9]+", "", example.lower())
            if normalized_definition and normalized_definition == normalized_example:
                blocking["definitionEqualsExample"].append(identity)
            if normalized_example in seen_examples:
                blocking["duplicateExamplesWithinWord"].append({**identity, "example": example})
            seen_examples.add(normalized_example)

            normalized_example_zh = re.sub(r"\s+", "", example_zh.lower())
            if normalized_example_zh in seen_example_translations:
                blocking["duplicateExampleTranslationsWithinWord"].append(
                    {**identity, "translation": example_zh}
                )
            seen_example_translations.add(normalized_example_zh)

            if str(sense.get("exampleSource", "")).endswith("-adapted"):
                blocking["adaptedExampleSources"].append(identity)

            counts["definitionTranslations"] += bool(definition_zh)
            counts["contextTranslations"] += bool(example_zh)
            latin = {
                token.lower()
                for token in re.findall(r"[A-Za-z]{3,}", example_zh)
                if token.lower() != word_entry["word"].lower()
            }
            if latin:
                review["latinTermsRetained"].append({**identity, "terms": sorted(latin)})
            if len(cjk_text(example_zh)) > 140:
                review["longTranslations"].append(
                    {**identity, "length": len(cjk_text(example_zh))}
                )

    return {
        "summary": dict(counts),
        "blockingIssueCounts": {key: len(value) for key, value in blocking.items() if value},
        "reviewFlagCounts": {key: len(value) for key, value in review.items() if value},
        "blockingIssues": dict(blocking),
        "reviewFlags": dict(review),
    }


def main():
    parser = argparse.ArgumentParser(description="Build Chinese translations for every example sentence")
    parser.add_argument("--offline", action="store_true", help="Only rebuild from the existing translation cache")
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    overrides = read_json(OVERRIDES_PATH, {}) or {}
    definition_overrides = read_json(DEFINITION_OVERRIDES_PATH, {}) or {}
    cache = read_json(CACHE_PATH, None)
    if not isinstance(cache, dict) or "definitions" not in cache or "examples" not in cache:
        cache = {
            "model": TRANSLATION_MODEL,
            "definitions": read_json(DEFINITION_CACHE_PATH, {}) or {},
            "examples": {},
        }

    examples = [
        sense.get("example", "")
        for word in words
        for sense in word.get("senses", [])
    ]
    context_keys = {
        f"{word['word']}|{sense.get('id', '')}"
        for word in words
        for sense in word.get("senses", [])
    }
    unused_overrides = sorted(set(overrides) - context_keys)
    if unused_overrides:
        raise RuntimeError(
            f"Context translation overrides contain {len(unused_overrides)} unused keys"
        )
    unused_definition_overrides = sorted(set(definition_overrides) - context_keys)
    if unused_definition_overrides:
        raise RuntimeError(
            f"Definition translation overrides contain {len(unused_definition_overrides)} unused keys"
        )

    translator = None
    if not args.offline:
        translator = LocalTranslator(MODEL_DIR)
    translate_missing(cache, "examples", examples, translator, args.batch_size, args.offline)

    for word_entry in words:
        for sense in word_entry.get("senses", []):
            override_key = f"{word_entry['word']}|{sense.get('id', '')}"
            if override_key in definition_overrides:
                sense["definitionZh"] = clean_zh_sentence(
                    definition_overrides[override_key]
                )
                sense["definitionZhSource"] = "human-reviewed"

            if override_key in overrides:
                translation = clean_zh_sentence(overrides[override_key])
                sense["exampleZhSource"] = "human-reviewed"
            else:
                translation = collapse_translation_repetitions(
                    cache["examples"].get(sense.get("example", ""), "")
                )
                sense["exampleZhSource"] = "argos-en-zh-local"
            sense["exampleZh"] = translation

    report = audit(words)
    write_json(WORDS_PATH, words)
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)
    print(json.dumps(report["blockingIssueCounts"], ensure_ascii=False), flush=True)
    if report["blockingIssueCounts"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
