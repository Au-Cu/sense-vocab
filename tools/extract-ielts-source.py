import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ECDICT = Path(r"D:\Files\ecdict.csv")
DATA_DIR = ROOT / "data"

SOURCE_URL = "https://github.com/skywind3000/ECDICT"
SOURCE_COMMIT_SHA = "c4ade63ea08cf39d9c3475e96929036d64d94c94"

# ECDICT contains a handful of spelling variants and inflected headwords.  A book
# should point at one canonical word record so progress cannot split across
# "co-operation" and "cooperation", for example.
ALIASES = {
    "amidst": "amid",
    "close-up": "closeup",
    "co-operation": "cooperation",
    "co-operative": "cooperative",
    "drop-out": "dropout",
    "first-aid": "first aid",
    "keyword": "key word",
    "mathematic": "mathematical",
    "neighbore": "neighbor",
    "non-drinker": "nondrinker",
    "ohp": "overhead projector",
    "pence": "penny",
    "second-hand": "secondhand",
    "tweezers": "tweezer",
    "water-clock": "water clock",
    "water-proof": "waterproof",
    "whilst": "while",
}

EXCLUDED = {
    "forbes": "proper name",
    "wollongong": "place name",
    "flourishment": "nonstandard derivative",
}

POS_MAP = {
    "n": "n.",
    "v": "v.",
    "vt": "v.",
    "vi": "v.",
    "a": "adj.",
    "s": "adj.",
    "adj": "adj.",
    "r": "adv.",
    "ad": "adv.",
    "adv": "adv.",
    "prep": "prep.",
    "conj": "conj.",
    "pron": "pron.",
    "num": "num.",
    "int": "int.",
    "abbr": "abbr.",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_exchange(exchange):
    result = {}
    for part in str(exchange or "").split("/"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        if value:
            result[key] = value.split(",")[0].strip().lower()
    return result


def is_simple_headword(word):
    return bool(re.fullmatch(r"[a-z]+(?:[-' ][a-z]+)*", word))


def normalize_definition_line(line):
    match = re.match(
        r"^\s*(n|v|vt|vi|a|s|adj|r|ad|adv|prep|conj|pron|num|int|abbr)\.?\s+(.+)$",
        line,
        re.I,
    )
    if not match:
        return None, re.sub(r"\s+", " ", line).strip()
    return POS_MAP.get(match.group(1).lower()), re.sub(r"\s+", " ", match.group(2)).strip()


def translation_groups(value):
    groups = []
    # ECDICT stores line breaks as the two literal characters "\\n" in CSV.
    # Normalize them before POS parsing so secondary noun/verb/adjective groups
    # do not get folded into the first sense.
    for raw_line in str(value or "").replace("\\n", "\n").splitlines():
        pos, text = normalize_definition_line(raw_line)
        text = re.sub(r"^\[[^\]]+\]\s*", "", text)
        if not text:
            continue
        groups.append({"translation": text, "type": pos or ""})
    return groups


def definition_groups(value):
    groups = []
    for raw_line in str(value or "").replace("\\n", "\n").splitlines():
        pos, definition = normalize_definition_line(raw_line)
        definition = definition.strip()
        if definition:
            groups.append({"pos": pos, "definition": definition})
    return groups


def choose_canonical(raw_word, row, kaoyan_words):
    word = raw_word.lower().strip()
    if word in kaoyan_words:
        return word, "exact-existing"
    if word in ALIASES:
        return ALIASES[word], "alias"
    exchange = parse_exchange(row.get("exchange"))
    lemma = exchange.get("0")
    # Only collapse an unmistakable plural.  Participles and comparative forms
    # often have independent high-frequency meanings (ground, accounting,
    # latest, pointed), so blindly following ECDICT's 0: lemma would delete
    # legitimate IELTS headwords.
    plural_form = exchange.get("s")
    inflection_codes = set(exchange.get("1", ""))
    if (
        lemma
        and (
            plural_form == word
            or ("s" in inflection_codes and inflection_codes <= {"s", "3"})
        )
        and is_simple_headword(lemma)
    ):
        if lemma in ALIASES:
            lemma = ALIASES[lemma]
        return lemma, "plural"
    return word, "headword"


def main():
    parser = argparse.ArgumentParser(
        description="Extract a reproducible IELTS book scope from ECDICT.",
    )
    parser.add_argument("--ecdict", type=Path, default=DEFAULT_ECDICT)
    args = parser.parse_args()

    ecdict_path = args.ecdict.resolve()
    if not ecdict_path.exists():
        raise FileNotFoundError(ecdict_path)

    kaoyan_path = DATA_DIR / "kaoyan-words.json"
    kaoyan = read_json(kaoyan_path)
    kaoyan_words = {entry["word"].lower(): entry for entry in kaoyan}
    kaoyan_hash_before = file_sha256(kaoyan_path)

    raw_rows = []
    with ecdict_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            tags = set(str(row.get("tag") or "").lower().split())
            if "ielts" not in tags:
                continue
            raw_word = str(row.get("word") or "").lower().strip()
            if not raw_word or not is_simple_headword(raw_word):
                continue
            if raw_word in EXCLUDED:
                continue
            raw_rows.append((raw_word, row))

    grouped = defaultdict(list)
    canonical_reasons = Counter()
    raw_aliases = {}
    for raw_word, row in raw_rows:
        canonical, reason = choose_canonical(raw_word, row, kaoyan_words)
        if canonical in EXCLUDED or not is_simple_headword(canonical):
            continue
        grouped[canonical].append((raw_word, row))
        canonical_reasons[reason] += 1
        if raw_word != canonical:
            raw_aliases[raw_word] = canonical

    source_rows = []
    dictionary_fallbacks = {}
    new_words = []
    book_words = []
    for canonical in sorted(grouped):
        rows = grouped[canonical]
        preferred = next((row for raw, row in rows if raw == canonical), rows[0][1])
        translations = []
        definitions = []
        phonetics = []
        raw_headwords = []
        seen_translations = set()
        seen_definitions = set()
        for raw_word, row in rows:
            raw_headwords.append(raw_word)
            if row.get("phonetic"):
                phonetics.append(row["phonetic"].strip())
            for item in translation_groups(row.get("translation")):
                key = (item["type"], item["translation"])
                if key not in seen_translations:
                    seen_translations.add(key)
                    translations.append(item)
            for item in definition_groups(row.get("definition")):
                key = (item["pos"], item["definition"].lower())
                if key not in seen_definitions:
                    seen_definitions.add(key)
                    definitions.append(item)

        source_rows.append(
            {
                "word": canonical,
                "translations": translations,
                "sourceHeadwords": sorted(set(raw_headwords)),
                "sourcePhonetic": next(iter(dict.fromkeys(phonetics)), ""),
            },
        )
        dictionary_fallbacks[canonical] = [
            {
                "pos": item["pos"] or "",
                "meaning": next(
                    (
                        translation["translation"]
                        for translation in translations
                        if not item["pos"] or translation["type"] == item["pos"]
                    ),
                    translations[0]["translation"] if translations else "",
                ),
                "definition": item["definition"],
                "source": "ECDICT:ielts",
            }
            for item in definitions
        ]
        book_words.append(canonical)
        if canonical not in kaoyan_words:
            new_words.append(
                {
                    "id": re.sub(r"[^a-z0-9]+", "-", canonical).strip("-"),
                    "word": canonical,
                    "senses": [],
                    "_ieltsSeed": {
                        "phonetic": preferred.get("phonetic", ""),
                        "definitions": definitions,
                    },
                },
            )

    write_json(DATA_DIR / "ielts-source.json", source_rows)
    write_json(DATA_DIR / "ielts-dictionary-definition-fallbacks.json", dictionary_fallbacks)
    write_json(DATA_DIR / "ielts-new-words.json", new_words)
    write_json(DATA_DIR / "ielts-book-words.json", book_words)
    empty_overrides_path = DATA_DIR / "ielts-empty-overrides.json"
    if not empty_overrides_path.exists():
        write_json(empty_overrides_path, [])
    translation_cache_path = DATA_DIR / "ielts-definition-translation-cache.json"
    if not translation_cache_path.exists():
        write_json(translation_cache_path, {})

    manifest = {
        "schemaVersion": 1,
        "source": {
            "name": "ECDICT",
            "url": SOURCE_URL,
            "license": "MIT",
            "upstreamBlobSha": SOURCE_COMMIT_SHA,
            "localSha256": file_sha256(ecdict_path),
        },
        "kaoyanSourceSha256": kaoyan_hash_before,
        "rawTaggedRows": len(raw_rows),
        "canonicalWordCount": len(book_words),
        "existingWordCount": sum(word in kaoyan_words for word in book_words),
        "newWordCount": len(new_words),
        "canonicalization": dict(sorted(canonical_reasons.items())),
        "aliases": dict(sorted(raw_aliases.items())),
        "excluded": EXCLUDED,
        "coverage": {
            "withEnglishDefinition": sum(
                bool(dictionary_fallbacks.get(word)) for word in book_words
            ),
            "withChineseTranslation": sum(
                bool(row["translations"]) for row in source_rows
            ),
            "withSourcePhonetic": sum(
                bool(row["sourcePhonetic"]) for row in source_rows
            ),
        },
    }
    write_json(DATA_DIR / "ielts-source-manifest.json", manifest)

    kaoyan_hash_after = file_sha256(kaoyan_path)
    if kaoyan_hash_after != kaoyan_hash_before:
        raise RuntimeError("The Kaoyan source file changed during IELTS extraction.")

    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
