import csv
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ECDICT_PATH = Path(r"D:\Files\ecdict.csv")
EXPECTED_KAOYAN_SHA256 = "f126e7d3308115be750d942c567f8712efd7af0554debf5037c5f92ba36adacf"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def file_sha256(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest.lower()


def word_id(word, provided=""):
    value = provided or word
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def normalized_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def sense_match_keys(sense):
    pos = str(sense.get("pos") or "").lower()
    synset_id = str(sense.get("synsetId") or "").strip()
    definition = normalized_text(
        sense.get("definitionSentence") or sense.get("definition")
    )
    meaning = normalized_text(sense.get("meaning"))
    keys = []
    if synset_id:
        keys.append(("synset", synset_id))
    if pos and definition:
        keys.append(("definition", pos, definition))
    if pos and meaning:
        keys.append(("meaning", pos, meaning))
    return keys


def normalize_word(entry, book_source, existing_word=None):
    normalized_senses = []
    seen = set()
    existing_by_key = {}
    existing_senses = (existing_word or {}).get("senses", [])
    for existing_sense in existing_senses:
        for key in sense_match_keys(existing_sense):
            existing_by_key.setdefault(key, []).append(existing_sense)
    used_ids = set()
    next_id_number = max(
        (
            int(match.group(1))
            for sense in existing_senses
            if (match := re.search(r"-(\d+)$", str(sense.get("id") or "")))
        ),
        default=0,
    ) + 1

    for sense_index, sense in enumerate(entry.get("senses", [])):
        if not sense.get("pos") or not sense.get("meaning"):
            continue
        # The reviewed Kaoyan source historically deduplicated by POS + Chinese
        # label. Preserve that exact behavior so its runtime IDs and progress do
        # not move. New IELTS records may legitimately share a Chinese label
        # while representing different dictionary senses (keyboard key,
        # database key, musical key), so their English definition is part of the
        # identity.
        key = (
            sense["pos"].lower(),
            sense["meaning"].lower(),
        ) if book_source == "kaoyan-reviewed" else (
            sense["pos"].lower(),
            sense["meaning"].lower(),
            re.sub(
                r"[^a-z0-9]+",
                " ",
                str(
                    sense.get("definitionSentence")
                    or sense.get("definition")
                    or ""
                ).lower(),
            ).strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        normalized = dict(sense)
        matched_id = None
        matched_existing = None
        for match_key in sense_match_keys(sense):
            matched = next(
                (
                    candidate
                    for candidate in existing_by_key.get(match_key, [])
                    if candidate.get("id") not in used_ids
                ),
                None,
            )
            if matched:
                matched_id = matched.get("id")
                matched_existing = matched
                break
        # A reviewed change set may update every textual match key while the
        # protected source order and part of speech remain unchanged. Preserve
        # the established runtime ID in that narrow case; the identity audit
        # still blocks any wider reorder or incompatible remapping.
        if not matched_id and sense_index < len(existing_senses):
            positional_candidate = existing_senses[sense_index]
            if (
                positional_candidate.get("id") not in used_ids
                and positional_candidate.get("pos") == sense.get("pos")
            ):
                matched_id = positional_candidate.get("id")
                matched_existing = positional_candidate
        if matched_id:
            normalized["id"] = matched_id
        else:
            while f"{sense['pos'].rstrip('.')}-{next_id_number}" in used_ids:
                next_id_number += 1
            normalized["id"] = f"{sense['pos'].rstrip('.')}-{next_id_number}"
            next_id_number += 1
        # Rights enrichment is attached to the exact recording URL. Source
        # normalization must not discard that evidence on a reproducible
        # rebuild when the recording itself is unchanged.
        if (
            matched_existing
            and normalized.get("audio")
            and normalized.get("audio") == matched_existing.get("audio")
        ):
            for field, value in matched_existing.items():
                if field.startswith("audio") and field not in normalized:
                    normalized[field] = value
        used_ids.add(normalized["id"])
        normalized["importance"] = max(
            1,
            int(sense.get("importance") or (100 - len(normalized_senses) * 3)),
        )
        normalized["bookSource"] = book_source
        normalized_senses.append(normalized)
    return {
        "id": word_id(entry["word"], entry.get("id", "")),
        "word": entry["word"],
        "morphology": entry.get("morphology"),
        "senses": normalized_senses,
    }


def ecdict_frequency(source_rows):
    headword_to_canonical = {}
    for row in source_rows:
        for headword in row.get("sourceHeadwords", []):
            headword_to_canonical[headword.lower()] = row["word"]

    rank = {}
    if not ECDICT_PATH.exists():
        return rank
    with ECDICT_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            canonical = headword_to_canonical.get(str(row.get("word") or "").lower())
            if not canonical:
                continue
            values = []
            for field in ("bnc", "frq"):
                try:
                    value = int(row.get(field) or 0)
                except ValueError:
                    value = 0
                if value > 0:
                    values.append(value)
            candidate = min(values) if values else 10**9
            rank[canonical] = min(rank.get(canonical, 10**9), candidate)
    return rank


def reviewed_metadata(manifest, item):
    source = f"openai-codex-reviewed:{manifest['batchId']}"
    fields = item.get("fields", {})
    metadata = {
        "auditStatus": "human-reviewed",
        "generationBatchId": manifest["batchId"],
        "humanReviewStatus": manifest["review"]["status"],
        "humanReviewedAt": manifest["review"]["reviewedAt"],
    }
    if "meaning" in fields:
        metadata["meaningSource"] = source
    if "definition" in fields or "definitionSentence" in fields:
        metadata["definitionSource"] = source
    if "definitionZh" in fields:
        metadata["definitionZhSource"] = source
    if "example" in fields:
        metadata["exampleSource"] = source
    if "exampleZh" in fields:
        metadata["exampleZhSource"] = source
    return metadata


def apply_reviewed_content_change_sets(bundle):
    words = {word["id"]: word for word in bundle["words"]}
    books = {book["id"]: book for book in bundle["books"]}
    for manifest_path in sorted((DATA_DIR / "content-change-sets").glob("*.json")):
        if manifest_path.name.endswith("-rights-ledger.json"):
            continue
        manifest = read_json(manifest_path)
        if manifest.get("review", {}).get("status") != "approved":
            continue
        for item in manifest.get("items", []):
            word = words.get(item["wordId"])
            if not word:
                raise RuntimeError(f"Reviewed change set references unknown word: {item['wordId']}")
            sense = next(
                (candidate for candidate in word["senses"] if candidate["id"] == item["senseId"]),
                None,
            )
            if item["action"] == "add":
                if sense:
                    raise RuntimeError(
                        f"Reviewed change set duplicates sense: {item['wordId']}:{item['senseId']}",
                    )
                fields = dict(item["fields"])
                sense = {
                    "id": item["senseId"],
                    "importance": item["importance"],
                    **fields,
                    **reviewed_metadata(manifest, item),
                    "ipa": fields.get("ipa") or word["senses"][0].get("ipa"),
                    "ipaSource": item.get("ipaSource") or word["senses"][0].get("ipaSource"),
                    "bookSource": "kaoyan-reviewed-feedback",
                }
                word["senses"].append(sense)
                for book_id in item.get("bookIds", []):
                    entry = next(
                        (
                            candidate
                            for candidate in books[book_id]["entries"]
                            if candidate["wordId"] == item["wordId"]
                        ),
                        None,
                    )
                    if not entry:
                        raise RuntimeError(
                            f"Reviewed change set has no {book_id} entry for {item['wordId']}",
                        )
                    if item["senseId"] not in entry["senseIds"]:
                        entry["senseIds"].append(item["senseId"])
            elif item["action"] == "update":
                if not sense:
                    raise RuntimeError(
                        f"Reviewed change set references unknown sense: {item['wordId']}:{item['senseId']}",
                    )
                sense.update(item["fields"])
                sense.update(reviewed_metadata(manifest, item))
            else:
                raise RuntimeError(f"Unsupported reviewed action: {item['action']}")


def main():
    kaoyan_path = DATA_DIR / "kaoyan-words.json"
    if file_sha256(kaoyan_path) != EXPECTED_KAOYAN_SHA256:
        raise RuntimeError(
            "Refusing to build: kaoyan-words.json does not match the protected source hash.",
        )

    kaoyan_raw = read_json(kaoyan_path)
    ielts_new_raw = read_json(DATA_DIR / "ielts-new-words.json")
    ielts_book_words = read_json(DATA_DIR / "ielts-book-words.json")
    ielts_sources = read_json(DATA_DIR / "ielts-source.json")
    source_manifest = read_json(DATA_DIR / "ielts-source-manifest.json")
    existing_bundle_path = DATA_DIR / "vocabulary-bundle.json"
    existing_bundle = read_json(existing_bundle_path) if existing_bundle_path.exists() else {}
    existing_by_word = {
        entry.get("id"): entry
        for entry in existing_bundle.get("words", [])
        if entry.get("id")
    }

    pool = []
    by_word = {}
    for entry in kaoyan_raw:
        normalized = normalize_word(
            entry,
            "kaoyan-reviewed",
            existing_by_word.get(word_id(entry["word"], entry.get("id", ""))),
        )
        if not normalized["senses"]:
            raise RuntimeError(f"Kaoyan word unexpectedly has no senses: {entry['word']}")
        pool.append(normalized)
        by_word[entry["word"].lower()] = normalized

    for entry in ielts_new_raw:
        normalized = normalize_word(
            entry,
            "ielts-open-dictionary-audited",
            existing_by_word.get(word_id(entry["word"], entry.get("id", ""))),
        )
        if not normalized["senses"]:
            raise RuntimeError(f"IELTS word has no senses: {entry['word']}")
        if entry["word"].lower() in by_word:
            raise RuntimeError(f"IELTS new-word collision: {entry['word']}")
        pool.append(normalized)
        by_word[entry["word"].lower()] = normalized

    frequency = ecdict_frequency(ielts_sources)
    ielts_book_words = sorted(
        set(ielts_book_words),
        key=lambda value: (frequency.get(value, 10**9), value),
    )

    def entry_for(word):
        pooled = by_word.get(word.lower())
        if not pooled:
            raise RuntimeError(f"Book references an unknown word: {word}")
        return {
            "wordId": pooled["id"],
            "senseIds": [sense["id"] for sense in pooled["senses"]],
        }

    books = [
        {
            "id": "kaoyan",
            "name": "考研词汇",
            "displayName": "《考研词汇》",
            "entries": [entry_for(entry["word"]) for entry in kaoyan_raw],
        },
        {
            "id": "ielts",
            "name": "雅思词汇",
            "displayName": "《雅思词汇》",
            "entries": [entry_for(word) for word in ielts_book_words],
        },
    ]

    bundle = {
        "schemaVersion": 1,
        "defaultBookId": "kaoyan",
        "books": books,
        "words": pool,
        "sources": {
            "kaoyan": {
                "sha256": EXPECTED_KAOYAN_SHA256,
                "protected": True,
            },
            "ielts": {
                "scope": source_manifest["source"],
                "content": [
                    {
                        "name": "Open English WordNet",
                        "url": "https://en-word.net/",
                        "license": "CC BY 4.0",
                    },
                    {
                        "name": "Kaikki / English Wiktionary",
                        "url": "https://kaikki.org/dictionary/English/",
                        "license": "CC BY-SA 3.0",
                    },
                    {
                        "name": "Tatoeba",
                        "url": "https://tatoeba.org/",
                        "license": "Per-sentence attribution retained in sense metadata",
                    },
                ],
                "translation": {
                    "name": "Argos Translate en_zh",
                    "mode": "offline build-time translation",
                },
            },
        },
    }
    apply_reviewed_content_change_sets(bundle)
    output_path = DATA_DIR / "vocabulary-bundle.json"
    write_json(output_path, bundle)

    word_ids = [entry["id"] for entry in pool]
    sense_ids = [
        f"{entry['id']}:{sense['id']}"
        for entry in pool
        for sense in entry["senses"]
    ]
    if len(word_ids) != len(set(word_ids)):
        raise RuntimeError("Shared pool contains duplicate word IDs.")
    if len(sense_ids) != len(set(sense_ids)):
        raise RuntimeError("Shared pool contains duplicate sense IDs.")

    report = {
        "schemaVersion": 1,
        "bundleSha256": file_sha256(output_path),
        "bundleBytes": output_path.stat().st_size,
        "poolWords": len(pool),
        "poolSenses": len(sense_ids),
        "books": {
            book["id"]: {
                "words": len(book["entries"]),
                "senses": sum(len(entry["senseIds"]) for entry in book["entries"]),
            }
            for book in books
        },
        "ielts": {
            "reusedPoolWords": sum(word.lower() in {
                entry["word"].lower() for entry in kaoyan_raw
            } for word in ielts_book_words),
            "newPoolWords": len(ielts_new_raw),
            "frequencyRankedWords": sum(word in frequency for word in ielts_book_words),
        },
        "kaoyanSourceSha256": file_sha256(kaoyan_path),
        "kaoyanUnchanged": file_sha256(kaoyan_path) == EXPECTED_KAOYAN_SHA256,
    }
    (DATA_DIR / "vocabulary-bundle-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
