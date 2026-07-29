import argparse
import json
import re
import tempfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import wn

from translation_provider import LOCAL_PROVIDER, translate_text


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
ADDITIONS_PATH = ROOT / "data" / "common-sense-additions.json"
TRANSLATION_CACHE_PATH = ROOT / "data" / "common-sense-argos-translation-cache.json"
REPORT_PATH = ROOT / "data" / "common-sense-additions-report.json"
INDEX_SENSE_PATH = (
    Path(tempfile.gettempdir()) / "wordnet30-corpus" / "wordnet" / "index.sense"
)

INDEX_POS = {"1": "n.", "2": "v.", "3": "adj.", "4": "adv.", "5": "adj."}
CJK_RE = re.compile(r"[\u3400-\u9fff]")
PLACEHOLDER_RE = re.compile(
    r"used with the meaning|helpful sentence|needs clue words|generic sentence|"
    r"points? to (?:a|this) (?:specific )?meaning|this (?:use|sense) of",
    re.I,
)


def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_sentence(value):
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    if text[-1] not in ".!?":
        text += "."
    return text


def clean_zh(value):
    text = re.sub(r"\s+", " ", str(value or "").strip())
    text = re.sub(r"\s+([，。；：！？])", r"\1", text)
    if text and text[-1] not in "。！？":
        text += "。"
    return text


def load_ranked_senses():
    ranked = defaultdict(list)
    for line in INDEX_SENSE_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        fields = line.split()
        if len(fields) < 4 or "%" not in fields[0]:
            continue
        sense_key, offset, sense_number, tag_count = fields[:4]
        lemma, code = sense_key.split("%", 1)
        pos = INDEX_POS.get(code[0])
        if not pos:
            continue
        wn_pos = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "s"}[code[0]]
        ranked[(lemma.lower(), pos)].append(
            {
                "synsetId": f"omw-en-{offset}-{wn_pos}",
                "senseNumber": int(sense_number),
                "tagCount": int(tag_count),
            }
        )
    for rows in ranked.values():
        rows.sort(key=lambda row: (-row["tagCount"], row["senseNumber"]))
    return ranked


def google_translate_one(text):
    return translate_text(text, "en", "zh-CN", timeout=45)


def ensure_translations(values, cache, fetch):
    required = [value for value in dict.fromkeys(values) if value and value not in cache]
    if required and not fetch:
        raise RuntimeError(
            f"{len(required)} translations are missing; rerun with --fetch-translations"
        )
    if required:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(google_translate_one, value): value for value in required}
            for index, future in enumerate(as_completed(futures), 1):
                value = futures[future]
                try:
                    cache[value] = future.result()
                except Exception as error:
                    raise RuntimeError(f"Translation failed for: {value}") from error
                if index % 25 == 0 or index == len(required):
                    print(f"translations: {index}/{len(required)}", flush=True)
        write_json(TRANSLATION_CACHE_PATH, cache)
    return cache


def main():
    parser = argparse.ArgumentParser(description="Apply human-reviewed corpus-leading senses")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--fetch-translations", action="store_true")
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    additions = read_json(ADDITIONS_PATH, [])
    cache = read_json(TRANSLATION_CACHE_PATH, {})
    ranked = load_ranked_senses()
    word_index = {entry["word"].lower(): entry for entry in words}

    prepared = []
    seen_keys = set()
    for addition in additions:
        word = addition["word"].lower()
        pos = addition["pos"]
        key = (word, pos)
        if key in seen_keys:
            raise ValueError(f"Duplicate common-sense addition: {word} {pos}")
        seen_keys.add(key)
        if word not in word_index:
            raise ValueError(f"Unknown word in common-sense additions: {word}")
        candidates = ranked.get((word.replace(" ", "_"), pos), [])
        if not candidates:
            raise ValueError(f"No WordNet candidate for {word} {pos}")
        candidate = candidates[0]
        synset = wn.synset(candidate["synsetId"])
        definition = synset.definition().strip()
        prepared.append({**addition, **candidate, "definition": definition})

    ensure_translations(
        [item["definition"] for item in prepared]
        + [item["example"] for item in prepared],
        cache,
        args.fetch_translations,
    )

    added = []
    already_present = []
    for item in prepared:
        entry = word_index[item["word"].lower()]
        if any(sense.get("synsetId") == item["synsetId"] for sense in entry["senses"]):
            already_present.append(f"{item['word']}::{item['synsetId']}")
            continue
        definition_sentence = clean_sentence(item["definition"])
        example = clean_sentence(item["example"])
        definition_zh = clean_zh(cache.get(item["definition"], ""))
        example_zh = clean_zh(cache.get(item["example"], ""))
        if CJK_RE.search(definition_sentence) or CJK_RE.search(example):
            raise RuntimeError(f"English content contains Chinese: {item['word']}")
        if PLACEHOLDER_RE.search(definition_sentence) or PLACEHOLDER_RE.search(example):
            raise RuntimeError(f"Placeholder content detected: {item['word']}")
        if not CJK_RE.search(definition_zh) or not CJK_RE.search(example_zh):
            raise RuntimeError(f"Chinese translation is missing: {item['word']}")
        suffix = item["synsetId"].removeprefix("omw-en-")
        sense = {
            "id": f"common-{suffix}",
            "pos": item["pos"],
            "meaning": item["meaning"],
            "importance": 110,
            "definition": item["definition"],
            "synsetId": item["synsetId"],
            "meaningSource": "human-reviewed-common-sense",
            "auditStatus": "human-reviewed",
            "definitionSentence": definition_sentence,
            "definitionZh": definition_zh,
            "definitionSource": "wordnet-human-reviewed",
            "definitionZhSource": f"{LOCAL_PROVIDER}-reviewed",
            "example": example,
            "exampleZh": example_zh,
            "exampleSource": "human-reviewed-common-sense",
            "exampleZhSource": f"{LOCAL_PROVIDER}-reviewed",
            "exampleQualityScore": 360,
        }
        entry["senses"].append(sense)
        entry["senses"].sort(key=lambda value: -int(value.get("importance", 0)))
        for index, existing in enumerate(entry["senses"]):
            existing["importance"] = max(1, 100 - index * 3)
        added.append(f"{item['word']}::{sense['id']}")

    report = {
        "summary": {
            "requested": len(additions),
            "added": len(added),
            "alreadyPresent": len(already_present),
        },
        "added": added,
        "alreadyPresent": already_present,
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    if args.write:
        write_json(WORDS_PATH, words)


if __name__ == "__main__":
    main()
