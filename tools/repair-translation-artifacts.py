import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
OVERRIDES_PATH = ROOT / "data" / "content-artifact-overrides.json"
COMMON_SENSE_ADDITIONS_PATH = ROOT / "data" / "common-sense-additions.json"
DEFINITION_OVERRIDES_PATH = ROOT / "data" / "sense-definition-overrides.json"
CONTEXT_OVERRIDES_PATH = ROOT / "data" / "context-example-overrides.jsonl"
TRANSLATION_OVERRIDES_PATH = ROOT / "data" / "example-translation-overrides.json"
GOOGLE_TRANSLATION_CACHE_PATH = ROOT / "data" / "google-translation-cache.json"
REPORT_PATH = ROOT / "data" / "content-artifact-cleanup-report.json"

CJK = r"[\u3400-\u9fff]"
MALFORMED_ZH_RE = re.compile(
    r"\bTo(?=" + CJK + r")|"
    r"\bTo[A-Za-z.'-]*(?=\s*(?:\u662f\u6307|\u610f\u5473\u7740|"
    r"\u7684\u610f\u601d|\u8868\u793a|\u610f\u4e3a))",
    re.I,
)
CORPUS_MARKER_RE = re.compile(r"\*\s*\*[A-Za-z]?|\*\s+[A-Za-z]\b")
LATIN_GLUE_RE = re.compile(
    r"\bTo[A-Za-z.'-]*(?=\s*(?:\u662f\u6307|\u610f\u5473\u7740|"
    r"\u7684\u610f\u601d|\u8868\u793a|\u610f\u4e3a|\u6307))",
    re.I,
)


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def read_jsonl(path):
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def write_jsonl(path, rows):
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def target_pattern(word):
    return re.compile(
        r"(?<![A-Za-z])" + re.escape(str(word)) + r"(?![A-Za-z])",
        re.I,
    )


def clean_definition_translation(
    word,
    value,
    definition_sentence="",
    strip_plain_is=False,
):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    target_re = target_pattern(word)
    text = target_re.sub("\u8be5\u4e49\u9879", text)
    text = re.sub(
        r"[\u201c\u201d\"\u2018\u2019']\s*\u8be5\u4e49\u9879\s*"
        r"[\u201c\u201d\"\u2018\u2019']",
        "\u8be5\u4e49\u9879",
        text,
    )
    text = LATIN_GLUE_RE.sub("\u8be5\u4e49\u9879", text)
    text = re.sub(r"\bTo(?=" + CJK + r")", "", text)
    text = re.sub(
        r"\u88ab\u63cf\u8ff0\u4e3a\s*\u8be5\u4e49\u9879\s*"
        r"\u7684(?:\u4e1c\u897f|\u4e8b\u7269)",
        "\u8be5\u4e49\u9879\u6240\u63cf\u8ff0\u7684\u4e8b\u7269",
        text,
    )
    fixed_prefix = re.match(
        r"^(?:To\s+)?" + re.escape(str(word)) +
        r"\s+(?:means|is|refers\s+to)\b",
        str(definition_sentence or ""),
        re.I,
    )
    if fixed_prefix:
        marker = r"是指|意味着|(?<!愿)意为|的意思是"
        if strip_plain_is:
            marker += r"|是"
        text = re.sub(
            r"^[^，。；：]{1,30}?(?:" + marker + r")\s*",
            "",
            text,
            count=1,
        )
    text = re.sub(r"\s+([\uff0c\u3002\uff1b\uff1a\uff01\uff1f])", r"\1", text)
    text = re.sub(r"\.\u3002$", "\u3002", text)
    return text


def build_sense_index(words):
    return {
        f"{word['word']}::{sense.get('id')}": (word, sense)
        for word in words
        for sense in word.get("senses", [])
    }


def main():
    parser = argparse.ArgumentParser(
        description="Remove mixed-language translation artifacts and corpus markers"
    )
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    config = read_json(OVERRIDES_PATH, {})
    definition_overrides = read_json(DEFINITION_OVERRIDES_PATH, {})
    translation_overrides = read_json(TRANSLATION_OVERRIDES_PATH, {})
    google_translation_cache = read_json(GOOGLE_TRANSLATION_CACHE_PATH, {})
    context_rows = read_jsonl(CONTEXT_OVERRIDES_PATH)
    context_by_key = {
        f"{row.get('word')}::{row.get('sense')}": row for row in context_rows
    }
    changed = defaultdict(list)

    remove_keys = set(config.get("removeSenses", []))
    for word in words:
        kept = []
        for sense in word.get("senses", []):
            key = f"{word['word']}::{sense.get('id')}"
            if key in remove_keys:
                changed["removedSenses"].append(key)
                definition_overrides.pop(key, None)
                translation_overrides.pop(key.replace("::", "|"), None)
                context_by_key.pop(key, None)
            else:
                kept.append(sense)
        word["senses"] = kept

    word_index = {word["word"].lower(): word for word in words}
    common_sense_additions = read_json(COMMON_SENSE_ADDITIONS_PATH, [])
    for addition in [
        *config.get("senseAdditions", []),
        *common_sense_additions,
    ]:
        word_name = str(addition.get("word", "")).lower()
        word = word_index.get(word_name)
        sense = dict(addition.get("sense") or {})
        if not word or not sense.get("id"):
            raise RuntimeError(f"Invalid sense addition: {addition}")
        if any(existing.get("id") == sense["id"] for existing in word["senses"]):
            continue
        if sense.get("definitionSentence") and not sense.get("definition"):
            sense["definition"] = sense["definitionSentence"]
        sense.setdefault("meaningSource", "human-reviewed-common-sense")
        sense.setdefault("auditStatus", "human-reviewed")
        sense.setdefault("definitionSource", "human-reviewed-common-sense")
        sense.setdefault("definitionZhSource", "human-reviewed-common-sense")
        sense.setdefault("exampleSource", "human-reviewed-common-sense")
        sense.setdefault("exampleZhSource", "human-reviewed-common-sense")
        sense.setdefault("exampleQualityScore", 360)
        if not sense.get("ipa"):
            source_sense = next(
                (
                    existing
                    for existing in word["senses"]
                    if existing.get("pos") == sense.get("pos") and existing.get("ipa")
                ),
                next(
                    (
                        existing
                        for existing in word["senses"]
                        if existing.get("ipa")
                    ),
                    None,
                ),
            )
            if source_sense:
                sense["ipa"] = source_sense["ipa"]
                sense["ipaSource"] = source_sense.get("ipaSource", "word-fallback")
        insert_at = max(0, min(int(addition.get("insertAt", 0)), len(word["senses"])))
        word["senses"].insert(insert_at, sense)
        for index, existing in enumerate(word["senses"]):
            existing["importance"] = max(1, 100 - index * 3)
        key = f"{word['word']}::{sense['id']}"
        changed["senseAdditions"].append(key)
        if sense.get("example"):
            context_by_key[key] = {
                "word": word["word"],
                "sense": sense["id"],
                "example": sense["example"],
            }
        if sense.get("exampleZh"):
            translation_overrides[key.replace("::", "|")] = sense["exampleZh"]

    sense_index = build_sense_index(words)
    requested_keys = (
        set(config.get("senseUpdates", {}))
        | set(config.get("definitionZhUpdates", {}))
        | set(config.get("exampleUpdates", {}))
    )
    missing_override_keys = sorted(requested_keys - set(sense_index))
    if missing_override_keys:
        raise RuntimeError(f"Unknown override keys: {missing_override_keys}")

    for key, updates in config.get("senseUpdates", {}).items():
        _, sense = sense_index[key]
        sense.update(updates)
        if "definitionSentence" in updates:
            sense["definitionSource"] = "human-reviewed-artifact-cleanup"
        if "definitionZh" in updates:
            sense["definitionZhSource"] = "human-reviewed-artifact-cleanup"
        changed["senseUpdates"].append(key)

    for key, value in config.get("definitionZhUpdates", {}).items():
        _, sense = sense_index[key]
        sense["definitionZh"] = value
        sense["definitionZhSource"] = "human-reviewed-artifact-cleanup"
        changed["definitionZhUpdates"].append(key)

    for key, updates in config.get("exampleUpdates", {}).items():
        word, sense = sense_index[key]
        sense["example"] = updates["example"]
        sense["exampleZh"] = updates["exampleZh"]
        sense["exampleSource"] = "manual-context-override"
        sense["exampleZhSource"] = "human-reviewed"
        sense["exampleQualityScore"] = 320
        changed["exampleUpdates"].append(key)
        context_by_key[key] = {
            "word": word["word"],
            "sense": sense["id"],
            "example": updates["example"],
        }
        translation_overrides[key.replace("::", "|")] = updates["exampleZh"]

    for word in words:
        for sense in word.get("senses", []):
            key = f"{word['word']}::{sense.get('id')}"
            current = str(sense.get("definitionZh", ""))
            before = current
            restored_from_cache = False
            cached = google_translation_cache.get(
                str(sense.get("definitionSentence", ""))
            )
            if sense.get("definitionZhSource") == "artifact-cleanup" and cached:
                before = cached
                restored_from_cache = True
            after = clean_definition_translation(
                word["word"],
                before,
                sense.get("definitionSentence", ""),
                strip_plain_is=(
                    restored_from_cache
                    or sense.get("definitionZhSource") == "google-translate-build"
                ),
            )
            if after != current:
                sense["definitionZh"] = after
                sense["definitionZhSource"] = "artifact-cleanup"
                changed["cleanedDefinitionTranslations"].append(key)
            entry = definition_overrides.setdefault(key, {})
            if sense.get("definitionSentence"):
                entry["definitionSentence"] = sense["definitionSentence"]
                entry["definitionSource"] = sense.get(
                    "definitionSource", entry.get("definitionSource", "dictionary-definition")
                )
            entry["definitionZh"] = sense.get("definitionZh", "")
            entry["definitionZhSource"] = sense.get(
                "definitionZhSource", "artifact-cleanup"
            )

    unresolved = defaultdict(list)
    for word in words:
        target_re = target_pattern(word["word"])
        for sense in word.get("senses", []):
            key = f"{word['word']}::{sense.get('id')}"
            for field in ("definitionZh", "exampleZh"):
                value = str(sense.get(field, ""))
                if target_re.search(value):
                    unresolved["untranslatedTarget"].append(
                        {"key": key, "field": field, "value": value}
                    )
                if MALFORMED_ZH_RE.search(value):
                    unresolved["malformedChinese"].append(
                        {"key": key, "field": field, "value": value}
                    )
            for field in ("definitionSentence", "definitionZh", "example", "exampleZh"):
                value = str(sense.get(field, ""))
                if CORPUS_MARKER_RE.search(value):
                    unresolved["corpusMarkers"].append(
                        {"key": key, "field": field, "value": value}
                    )

    report = {
        "summary": {
            "words": len(words),
            "senses": sum(len(word.get("senses", [])) for word in words),
            "changeCounts": {name: len(items) for name, items in changed.items()},
            "unresolvedCounts": {
                name: len(items) for name, items in unresolved.items()
            },
        },
        "changes": dict(changed),
        "unresolved": dict(unresolved),
    }
    print(json.dumps(report["summary"], ensure_ascii=False))

    if unresolved:
        write_json(REPORT_PATH, report)
        raise RuntimeError("Refusing to write unresolved translation artifacts")

    if args.write:
        write_json(WORDS_PATH, words)
        write_json(DEFINITION_OVERRIDES_PATH, definition_overrides)
        write_json(TRANSLATION_OVERRIDES_PATH, translation_overrides)
        write_jsonl(
            CONTEXT_OVERRIDES_PATH,
            sorted(
                context_by_key.values(),
                key=lambda row: (str(row.get("word")), str(row.get("sense"))),
            ),
        )
    write_json(REPORT_PATH, report)


if __name__ == "__main__":
    main()
