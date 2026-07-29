import argparse
import json
import re
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
REPORT_PATH = ROOT / "data" / "example-sense-alignment-audit.json"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def mask_headword(word, example):
    word = re.escape(word)
    pattern = re.compile(
        rf"\b{word}(?:s|es|ed|ing)?\b",
        re.I,
    )
    return pattern.sub("the target word", example)


def main():
    parser = argparse.ArgumentParser(
        description="Audit whether every English example expresses its sense definition"
    )
    parser.add_argument("--issue-threshold", type=float, default=0.08)
    parser.add_argument("--review-threshold", type=float, default=0.14)
    parser.add_argument("--confusion-margin", type=float, default=0.08)
    parser.add_argument("--alternate-threshold", type=float, default=0.14)
    args = parser.parse_args()

    words = read_json(WORDS_PATH)
    texts = []
    indices = {}

    def text_index(value):
        value = normalize(value)
        if value not in indices:
            indices[value] = len(texts)
            texts.append(value)
        return indices[value]

    rows = []
    rows_by_word = {}
    for word in words:
        word_rows = []
        for sense in word.get("senses", []):
            definition = normalize(sense.get("definitionSentence"))
            example = normalize(sense.get("example"))
            masked = mask_headword(word["word"], example)
            row = {
                "key": f"{word['word']}::{sense.get('id')}",
                "word": word["word"],
                "pos": sense.get("pos", ""),
                "meaning": sense.get("meaning", ""),
                "definitionSentence": definition,
                "example": example,
                "exampleZh": sense.get("exampleZh", ""),
                "definitionIndex": text_index(definition),
                "exampleIndex": text_index(masked),
            }
            rows.append(row)
            word_rows.append(row)
        rows_by_word[word["word"]] = word_rows

    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=256,
        show_progress_bar=True,
    )
    scored = []
    issues = []
    review = []
    for row in rows:
        expected_score = float(
            np.dot(
                embeddings[row["definitionIndex"]],
                embeddings[row["exampleIndex"]],
            )
        )
        alternatives = []
        for alternate in rows_by_word[row["word"]]:
            if alternate["key"] == row["key"]:
                continue
            alternate_score = float(
                np.dot(
                    embeddings[alternate["definitionIndex"]],
                    embeddings[row["exampleIndex"]],
                )
            )
            alternatives.append((alternate_score, alternate))
        alternatives.sort(key=lambda item: item[0], reverse=True)
        best_alternate_score, best_alternate = (
            alternatives[0] if alternatives else (-1.0, None)
        )
        margin = best_alternate_score - expected_score
        result = {
            key: value
            for key, value in row.items()
            if key not in {"definitionIndex", "exampleIndex"}
        }
        result.update(
            {
                "score": round(expected_score, 4),
                "bestAlternateKey": (
                    best_alternate["key"] if best_alternate else ""
                ),
                "bestAlternateMeaning": (
                    best_alternate["meaning"] if best_alternate else ""
                ),
                "bestAlternateScore": round(best_alternate_score, 4),
                "confusionMargin": round(margin, 4),
            }
        )
        scored.append(result)
        is_confused = (
            best_alternate is not None
            and best_alternate_score >= args.alternate_threshold
            and margin >= args.confusion_margin
        )
        if is_confused:
            issues.append(result)
        elif expected_score < args.review_threshold:
            review.append(result)
    issues.sort(key=lambda row: row["confusionMargin"], reverse=True)
    review.sort(key=lambda row: row["score"])
    report = {
        "summary": {
            "words": len(words),
            "senses": len(rows),
            "uniqueTexts": len(texts),
            "issueThreshold": args.issue_threshold,
            "reviewThreshold": args.review_threshold,
            "confusionMargin": args.confusion_margin,
            "alternateThreshold": args.alternate_threshold,
            "issues": len(issues),
            "review": len(review),
        },
        "issues": issues,
        "review": review,
        "scores": scored,
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    for row in issues:
        print(
            f"{row['key']}\t{row['score']}\t{row['confusionMargin']}\t"
            f"{row['meaning']}\t{row['bestAlternateMeaning']}\t"
            f"{row['definitionSentence']}\t{row['example']}"
        )


if __name__ == "__main__":
    main()
