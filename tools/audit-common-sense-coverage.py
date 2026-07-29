import argparse
import json
import re
import sqlite3
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

from translation_provider import translate_text


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
REPORT_PATH = ROOT / "data" / "common-sense-coverage-audit.json"
TRANSLATION_CACHE_PATH = ROOT / "data" / "common-sense-argos-translation-cache.json"
DECISIONS_PATH = ROOT / "data" / "common-sense-coverage-decisions.json"
NON_WORDNET_DECISIONS_PATH = (
    ROOT / "data" / "common-sense-nonwordnet-decisions.json"
)
INDEX_SENSE_PATH = (
    Path(tempfile.gettempdir()) / "wordnet30-corpus" / "wordnet" / "index.sense"
)
WN_DB_PATH = Path.home() / ".wn_data" / "wn.db"

INDEX_POS = {"1": "n.", "2": "v.", "3": "adj.", "4": "adv.", "5": "adj."}
DB_POS = {"n": "n.", "v": "v.", "a": "adj.", "s": "adj.", "r": "adv."}
STANDARD_POS = ("n.", "v.", "adj.", "adv.")
PERSON_RE = re.compile(
    r"\b(?:born|died|king|queen|president|poet|writer|actor|actress|composer|"
    r"politician|general|saint)\b.*\b\d{3,4}\b|\b\d{3,4}\s*[-–]\s*\d{2,4}\b",
    re.I,
)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_lemma(value):
    return value.lower().replace(" ", "_")


def normalize_zh(value):
    return "".join(re.findall(r"[\u4e00-\u9fff]", str(value or "")))


def zh_parts(value):
    return {
        normalize_zh(part)
        for part in re.split(r"[，、,;/；（）()]", str(value or ""))
        if normalize_zh(part)
    }


def chinese_overlap(candidate_lemmas, meaning):
    current = zh_parts(meaning)
    for left in candidate_lemmas:
        left = normalize_zh(left)
        if len(left) < 2:
            continue
        for right in current:
            if left == right or (len(right) >= 2 and (left in right or right in left)):
                return True
    return False


def translated_chinese_overlap(candidate_translation, meaning):
    candidate = normalize_zh(candidate_translation)
    if not candidate:
        return False
    for part in zh_parts(meaning):
        core = re.sub(r"(?:的|地|得|者)$", "", part)
        if len(core) >= 2 and core in candidate:
            return True
    return False


def google_translate_one(text):
    return translate_text(text, "en", "zh-CN", timeout=45)


def ensure_translation_cache(values, cache):
    required = [value for value in dict.fromkeys(values) if value and value not in cache]
    delimiter = " ||| "
    for start in range(0, len(required), 24):
        batch = required[start : start + 24]
        try:
            translated = google_translate_one(delimiter.join(batch))
            parts = re.split(r"\s*\|\|\|\s*", translated)
            if len(parts) != len(batch):
                raise ValueError("translation delimiter count changed")
            cache.update(zip(batch, parts))
        except Exception:
            for value in batch:
                try:
                    cache[value] = google_translate_one(value)
                except Exception:
                    cache[value] = ""
        print(
            f"candidate translations: {min(start + len(batch), len(required))}/{len(required)}",
            flush=True,
        )
    write_json(TRANSLATION_CACHE_PATH, cache)
    return cache


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
        ranked[(lemma.lower(), pos)].append(
            {
                "pos": pos,
                "synsetId": f"omw-en-{offset}-{code[0] == '5' and 's' or code[0] == '3' and 'a' or code[0] == '4' and 'r' or code[0] == '2' and 'v' or 'n'}",
                "senseNumber": int(sense_number),
                "tagCount": int(tag_count),
            }
        )
    for rows in ranked.values():
        rows.sort(key=lambda row: (-row["tagCount"], row["senseNumber"]))
    return ranked


def load_wordnet():
    connection = sqlite3.connect(WN_DB_PATH)
    connection.row_factory = sqlite3.Row
    lexicons = {
        row["specifier"]: row["rowid"]
        for row in connection.execute("SELECT rowid, specifier FROM lexicons")
    }
    en_id = lexicons["omw-en:2.0"]
    zh_id = lexicons["omw-cmn:2.0"]
    zh_by_ili = defaultdict(set)
    for row in connection.execute(
        """SELECT i.id ili, f.form lemma FROM synsets s
           JOIN ilis i ON i.rowid=s.ili_rowid
           JOIN senses se ON se.synset_rowid=s.rowid
           JOIN entries e ON e.rowid=se.entry_rowid
           JOIN forms f ON f.entry_rowid=e.rowid AND f.rank=0
           WHERE s.lexicon_rowid=? AND e.lexicon_rowid=?""",
        (zh_id, zh_id),
    ):
        zh_by_ili[row["ili"]].add(row["lemma"])
    evidence = {}
    for row in connection.execute(
        """WITH first_def AS (
             SELECT synset_rowid, MIN(rowid) definition_rowid FROM definitions
             WHERE lexicon_rowid=? GROUP BY synset_rowid
           )
           SELECT s.id,s.pos,i.id ili,d.definition FROM synsets s
           LEFT JOIN ilis i ON i.rowid=s.ili_rowid
           LEFT JOIN first_def fd ON fd.synset_rowid=s.rowid
           LEFT JOIN definitions d ON d.rowid=fd.definition_rowid
           WHERE s.lexicon_rowid=?""",
        (en_id, en_id),
    ):
        evidence[row["id"]] = {
            "pos": DB_POS.get(row["pos"]),
            "definition": row["definition"] or "",
            "zh": sorted(zh_by_ili.get(row["ili"], set())),
        }
    connection.close()
    return evidence


def main():
    parser = argparse.ArgumentParser(
        description="Audit coverage of each word's most frequent senses by part of speech"
    )
    parser.add_argument("--min-tag-count", type=int, default=10)
    parser.add_argument("--senses-per-pos", type=int, default=2)
    parser.add_argument("--fetch-translations", action="store_true")
    args = parser.parse_args()

    if not INDEX_SENSE_PATH.exists() or not WN_DB_PATH.exists():
        raise FileNotFoundError("WordNet index.sense or wn.db is missing")
    words = read_json(WORDS_PATH)
    translation_cache = read_json(TRANSLATION_CACHE_PATH) if TRANSLATION_CACHE_PATH.exists() else {}
    decisions = read_json(DECISIONS_PATH) if DECISIONS_PATH.exists() else {}
    non_wordnet_decisions = (
        read_json(NON_WORDNET_DECISIONS_PATH)
        if NON_WORDNET_DECISIONS_PATH.exists()
        else {}
    )
    ranked = load_ranked_senses()
    evidence = load_wordnet()

    checks = []
    skipped = []
    texts = []
    for word_entry in words:
        lemma = normalize_lemma(word_entry["word"])
        by_pos = defaultdict(list)
        for sense in word_entry.get("senses", []):
            if sense.get("pos") in STANDARD_POS:
                by_pos[sense["pos"]].append(sense)
        candidates = []
        seen_synsets = set()
        for pos in STANDARD_POS:
            for row in ranked.get((lemma, pos), [])[: args.senses_per_pos]:
                if row["synsetId"] in seen_synsets:
                    continue
                seen_synsets.add(row["synsetId"])
                candidates.append(row)
        if not candidates:
            skipped.append(
                {
                    "word": word_entry["word"],
                    "reason": "no-ranked-standard-pos-sense",
                }
            )
            continue
        check_count_before = len(checks)
        for candidate in candidates:
            pos = candidate["pos"]
            senses = by_pos.get(pos, [])
            info = evidence.get(candidate["synsetId"])
            if not info or not info["definition"] or PERSON_RE.search(info["definition"]):
                continue
            exact = any(sense.get("synsetId") == candidate["synsetId"] for sense in senses)
            candidate_text_indices = []
            sense_text_indices = []
            if not exact and senses:
                candidate_text_indices.append(len(texts))
                texts.append(info["definition"])
                candidate_text_indices.append(len(texts))
                texts.append(translation_cache.get(info["definition"], ""))
                for sense in senses:
                    sense_text_indices.append(len(texts))
                    texts.append(str(sense.get("meaning", "")))
            checks.append(
                {
                    "word": word_entry["word"],
                    "pos": pos,
                    "candidate": {**candidate, **info},
                    "current": senses,
                    "candidateTextIndices": candidate_text_indices,
                    "senseTextIndices": sense_text_indices,
                    "exact": exact,
                }
            )
        if len(checks) == check_count_before:
            skipped.append(
                {
                    "word": word_entry["word"],
                    "reason": "missing-or-filtered-wordnet-evidence",
                }
            )

    if args.fetch_translations:
        ensure_translation_cache(
            [check["candidate"]["definition"] for check in checks if not check["exact"]],
            translation_cache,
        )
    for check in checks:
        if not check["exact"] and check["candidateTextIndices"]:
            texts[check["candidateTextIndices"][1]] = translation_cache.get(
                check["candidate"]["definition"],
                "",
            )
    if texts:
        model = SentenceTransformer(
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=128,
            show_progress_bar=False,
        )
    else:
        embeddings = np.empty((0, 0))

    rows = []
    unresolved = []
    status_counts = defaultdict(int)
    for check in checks:
        candidate = check["candidate"]
        senses = check["current"]
        exact = check["exact"]
        if exact:
            best_index = next(
                index
                for index, sense in enumerate(senses)
                if sense.get("synsetId") == candidate["synsetId"]
            )
            similarity = 1.0
        elif senses:
            candidate_vectors = embeddings[check["candidateTextIndices"]]
            sense_vectors = embeddings[check["senseTextIndices"]]
            similarities = np.max(
                np.asarray(sense_vectors) @ np.asarray(candidate_vectors).T,
                axis=1,
            )
            best_index = int(np.argmax(similarities))
            similarity = float(similarities[best_index])
        else:
            best_index = None
            similarity = 0.0
        candidate_translation = translation_cache.get(candidate["definition"], "")
        zh_match = any(
            chinese_overlap(candidate["zh"], sense.get("meaning", ""))
            or translated_chinese_overlap(candidate_translation, sense.get("meaning", ""))
            for sense in senses
        )
        if exact:
            status = "exact-synset"
        elif zh_match:
            status = "chinese-semantic-match"
        elif similarity >= 0.50:
            status = "semantic-match"
        elif candidate["tagCount"] >= args.min_tag_count and (
            not senses or (similarity < 0.38 and not zh_match)
        ):
            status = "missing-high-confidence"
        else:
            status = "review"
        decision_key = f"{check['word'].lower()}::{candidate['synsetId']}"
        decision = decisions.get(decision_key)
        if decision and not exact:
            if decision.get("word", "").lower() != check["word"].lower():
                raise ValueError(
                    f"Coverage decision word mismatch for {candidate['synsetId']}"
                )
            if decision.get("decision") == "covered":
                status = "human-reviewed-covered"
            elif decision.get("decision") == "not-core":
                status = "human-reviewed-not-core"
            else:
                raise ValueError(
                    f"Unknown coverage decision for {candidate['synsetId']}"
                )
        row = {
            "word": check["word"],
            "pos": check["pos"],
            "status": status,
            "tagCount": candidate["tagCount"],
            "senseNumber": candidate["senseNumber"],
            "candidateSynsetId": candidate["synsetId"],
            "candidateDefinition": candidate["definition"],
            "candidateChinese": candidate["zh"],
            "candidateTranslation": candidate_translation,
            "bestSimilarity": round(similarity, 4),
            "humanDecision": decision,
            "bestCurrentSense": (
                {
                    "id": senses[best_index].get("id"),
                    "meaning": senses[best_index].get("meaning"),
                    "definitionSentence": senses[best_index].get("definitionSentence"),
                }
                if best_index is not None
                else None
            ),
        }
        rows.append(row)
        status_counts[status] += 1
        if status == "missing-high-confidence":
            unresolved.append(row)

    unresolved.sort(key=lambda row: (-row["tagCount"], row["bestSimilarity"], row["word"]))
    skipped_words = {row["word"].lower() for row in skipped}
    manual_skipped = []
    unreviewed_skipped = []
    for row in skipped:
        decision = non_wordnet_decisions.get(row["word"].lower())
        reviewed = bool(decision and decision.get("decision") == "covered")
        enriched = {**row, "humanDecision": decision}
        if reviewed:
            manual_skipped.append(enriched)
        else:
            unreviewed_skipped.append(enriched)
    report = {
        "summary": {
            "words": len(words),
            "checks": len(checks),
            "manuallyReviewedSkipped": len(manual_skipped),
            "totalAudited": len(checks) + len(manual_skipped),
            "minTagCount": args.min_tag_count,
            "sensesPerPos": args.senses_per_pos,
            "statusCounts": dict(status_counts),
            "missingHighConfidence": len(unresolved),
        },
        "missingHighConfidence": unresolved,
        "manuallyReviewedSkipped": manual_skipped,
        "unreviewedSkipped": unreviewed_skipped,
        "checks": rows,
    }
    checked_decisions = {
        f"{row['word'].lower()}::{row['candidateSynsetId']}" for row in rows
    }
    unused_decisions = sorted(set(decisions) - checked_decisions)
    if unused_decisions:
        raise RuntimeError(f"Unused common-sense coverage decisions: {unused_decisions}")
    unused_non_wordnet = sorted(set(non_wordnet_decisions) - skipped_words)
    report["obsoleteNonWordNetDecisions"] = unused_non_wordnet
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    for row in unresolved:
        print(
            f"{row['word']}\t{row['pos']}\ttag={row['tagCount']}\t"
            f"sim={row['bestSimilarity']}\t{row['candidateDefinition']}\t"
            f"current={row['bestCurrentSense'] and row['bestCurrentSense']['meaning']}"
        )
    if unresolved or unreviewed_skipped:
        raise RuntimeError(
            "Common-sense coverage audit has unresolved high-confidence or skipped words"
        )


if __name__ == "__main__":
    main()
