import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
REPORT_PATH = ROOT / "data" / "sense-semantic-alignment-audit.json"
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(
        description="Cross-lingual semantic audit for every definition and example"
    )
    parser.add_argument("--translation-threshold", type=float, default=0.34)
    parser.add_argument("--meaning-definition-threshold", type=float, default=0.16)
    parser.add_argument("--meaning-example-threshold", type=float, default=0.06)
    parser.add_argument(
        "--all",
        action="store_true",
        help="Encode every pair instead of trusting unchanged machine-translation provenance",
    )
    args = parser.parse_args()

    words = read_json(WORDS_PATH)
    rows = []
    unique_texts = {}
    texts = []

    def text_index(value):
        value = str(value or "").strip()
        if value not in unique_texts:
            unique_texts[value] = len(texts)
            texts.append(value)
        return unique_texts[value]

    for word in words:
        for sense in word.get("senses", []):
            sources = {
                field: sense.get(field, "")
                for field in (
                    "auditStatus",
                    "meaningSource",
                    "definitionSource",
                    "definitionZhSource",
                    "exampleSource",
                    "exampleZhSource",
                )
            }
            requires_semantic_model = args.all or any(
                "human-reviewed" in str(value)
                for value in sources.values()
            ) or sources["auditStatus"] == "human-reviewed"
            row = {
                "key": f"{word['word']}::{sense.get('id')}",
                "meaning": sense.get("meaning", ""),
                "definitionSentence": sense.get("definitionSentence", ""),
                "definitionZh": sense.get("definitionZh", ""),
                "example": sense.get("example", ""),
                "exampleZh": sense.get("exampleZh", ""),
                "sources": sources,
                "requiresSemanticModel": requires_semantic_model,
            }
            if requires_semantic_model:
                row["indices"] = {
                    field: text_index(sense.get(field, ""))
                    for field in (
                        "meaning",
                        "definitionSentence",
                        "definitionZh",
                        "example",
                        "exampleZh",
                    )
                }
            rows.append(row)

    embeddings = None
    if texts:
        model = SentenceTransformer(MODEL_NAME)
        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=128,
            show_progress_bar=True,
        )
    issues = defaultdict(list)
    scored = []

    def similarity(left, right):
        return float(np.dot(embeddings[left], embeddings[right]))

    for row in rows:
        if not row["requiresSemanticModel"]:
            scored.append(
                {
                    key: value
                    for key, value in row.items()
                    if key not in {"indices", "requiresSemanticModel"}
                }
                | {"verification": "translation-provenance"}
            )
            continue
        index = row["indices"]
        definition_translation = similarity(
            index["definitionSentence"],
            index["definitionZh"],
        )
        example_translation = similarity(index["example"], index["exampleZh"])
        meaning_definition = max(
            similarity(index["meaning"], index["definitionSentence"]),
            similarity(index["meaning"], index["definitionZh"]),
        )
        meaning_example = max(
            similarity(index["meaning"], index["example"]),
            similarity(index["meaning"], index["exampleZh"]),
        )
        result = {
            key: value
            for key, value in row.items()
            if key not in {"indices", "requiresSemanticModel"}
        }
        result["verification"] = "semantic-model"
        result["scores"] = {
            "definitionTranslation": round(definition_translation, 4),
            "exampleTranslation": round(example_translation, 4),
            "meaningDefinition": round(meaning_definition, 4),
            "meaningExample": round(meaning_example, 4),
        }
        scored.append(result)
        if definition_translation < args.translation_threshold:
            issues["definitionTranslationMismatch"].append(result)
        if example_translation < args.translation_threshold:
            issues["exampleTranslationMismatch"].append(result)
        if (
            meaning_definition < args.meaning_definition_threshold
            and meaning_example < args.meaning_definition_threshold
        ):
            issues["meaningDefinitionMismatch"].append(result)
        if (
            meaning_example < args.meaning_example_threshold
            and meaning_definition < args.meaning_definition_threshold + 0.08
        ):
            issues["meaningExampleMismatch"].append(result)

    for values in issues.values():
        values.sort(
            key=lambda row: min(
                row["scores"]["definitionTranslation"],
                row["scores"]["exampleTranslation"],
                row["scores"]["meaningDefinition"],
                row["scores"]["meaningExample"],
            )
        )
    report = {
        "summary": {
            "words": len(words),
            "senses": len(rows),
            "semanticModelChecks": sum(
                row["requiresSemanticModel"] for row in rows
            ),
            "translationProvenanceChecks": sum(
                not row["requiresSemanticModel"] for row in rows
            ),
            "uniqueTexts": len(texts),
            "thresholds": {
                "translation": args.translation_threshold,
                "meaningDefinition": args.meaning_definition_threshold,
                "meaningExample": args.meaning_example_threshold,
            },
            "issueCounts": {
                name: len(values) for name, values in issues.items()
            },
        },
        "issues": dict(issues),
        "scores": scored,
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
