import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
SOURCE_PATH = ROOT / "data" / "dictionary-definition-fallbacks.json"
REPORT_PATH = ROOT / "data" / "source-meaning-coverage-audit.json"
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def chinese_parts(value):
    return [
        re.sub(r"[^\u4e00-\u9fff]", "", part)
        for part in re.split(r"[,，;；/、()（）]", str(value or ""))
        if re.sub(r"[^\u4e00-\u9fff]", "", part)
    ]


def has_chinese_overlap(candidate, current):
    candidate_parts = chinese_parts(candidate)
    current_parts = chinese_parts(current)
    for left in candidate_parts:
        for right in current_parts:
            if len(left) < 2 or len(right) < 2:
                continue
            if left == right or left in right or right in left:
                return True
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Audit repeated source-dictionary meanings against current senses"
    )
    parser.add_argument("--min-source-support", type=int, default=2)
    parser.add_argument("--covered-threshold", type=float, default=0.58)
    parser.add_argument("--missing-threshold", type=float, default=0.40)
    args = parser.parse_args()

    words = read_json(WORDS_PATH)
    source = read_json(SOURCE_PATH)
    word_by_name = {entry["word"].lower(): entry for entry in words}
    candidates = []

    for name, source_rows in source.items():
        word = word_by_name.get(name.lower())
        if not word:
            continue
        grouped = defaultdict(list)
        for source_index, row in enumerate(source_rows):
            pos = row.get("pos")
            definition = normalize_text(row.get("definition"))
            if not pos or not definition:
                continue
            grouped[(pos, definition)].append((source_index, row))

        for (pos, definition), rows in grouped.items():
            support = len(rows)
            if support < args.min_source_support:
                continue
            current = [
                sense for sense in word.get("senses", []) if sense.get("pos") == pos
            ]
            representative = rows[0][1]
            source_meanings = [
                row.get("meaning", "")
                for _, row in rows
                if row.get("meaning")
            ]
            meaning = Counter(source_meanings).most_common(1)[0][0]
            lexical_match = any(
                has_chinese_overlap(meaning, sense.get("meaning", ""))
                for sense in current
            )
            candidates.append(
                {
                    "word": word["word"],
                    "pos": pos,
                    "support": support,
                    "meaning": meaning,
                    "definition": representative.get("definition", ""),
                    "sourceRows": [row.get("source") for _, row in rows],
                    "current": [
                        {
                            "id": sense.get("id"),
                            "meaning": sense.get("meaning", ""),
                            "definitionSentence": sense.get(
                                "definitionSentence",
                                sense.get("definition", ""),
                            ),
                        }
                        for sense in current
                    ],
                    "lexicalMatch": lexical_match,
                }
            )

    texts = []
    text_indices = {}

    def text_index(value):
        value = normalize_text(value)
        if value not in text_indices:
            text_indices[value] = len(texts)
            texts.append(value)
        return text_indices[value]

    for candidate in candidates:
        candidate["candidateIndex"] = text_index(
            f"{candidate['meaning']}. {candidate['definition']}"
        )
        candidate["currentIndices"] = [
            text_index(f"{sense['meaning']}. {sense['definitionSentence']}")
            for sense in candidate["current"]
        ]

    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=128,
        show_progress_bar=True,
    )

    status_counts = Counter()
    rows = []
    for candidate in candidates:
        current_indices = candidate.pop("currentIndices")
        candidate_index = candidate.pop("candidateIndex")
        similarities = [
            float(np.dot(embeddings[candidate_index], embeddings[index]))
            for index in current_indices
        ]
        best_similarity = max(similarities, default=0.0)
        best_index = int(np.argmax(similarities)) if similarities else None
        if candidate["lexicalMatch"] or best_similarity >= args.covered_threshold:
            status = "covered"
        elif best_similarity < args.missing_threshold:
            status = "missing-high-confidence"
        else:
            status = "review"
        row = {
            **candidate,
            "status": status,
            "bestSimilarity": round(best_similarity, 4),
            "bestCurrentSense": (
                candidate["current"][best_index]
                if best_index is not None
                else None
            ),
        }
        rows.append(row)
        status_counts[status] += 1

    missing = [
        row for row in rows if row["status"] == "missing-high-confidence"
    ]
    review = [row for row in rows if row["status"] == "review"]
    ordering = lambda row: (
        -row["support"],
        row["bestSimilarity"],
        row["word"],
        row["pos"],
    )
    missing.sort(key=ordering)
    review.sort(key=ordering)
    report = {
        "summary": {
            "words": len(words),
            "candidates": len(rows),
            "minSourceSupport": args.min_source_support,
            "coveredThreshold": args.covered_threshold,
            "missingThreshold": args.missing_threshold,
            "statusCounts": dict(status_counts),
        },
        "missingHighConfidence": missing,
        "review": review,
        "checks": rows,
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    for row in missing:
        current = row["bestCurrentSense"]
        print(
            f"{row['word']}\t{row['pos']}\tsupport={row['support']}\t"
            f"sim={row['bestSimilarity']}\t{row['meaning']}\t"
            f"current={current and current['meaning']}"
        )


if __name__ == "__main__":
    main()
