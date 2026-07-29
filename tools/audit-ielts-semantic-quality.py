import json
import re
from collections import Counter
from pathlib import Path

import nltk
import numpy as np
from fastembed import TextEmbedding
from nltk.tokenize import TreebankWordTokenizer
from sentence_transformers import SentenceTransformer


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
WORDS_PATH = DATA / "ielts-new-words.json"
REPORT_PATH = DATA / "ielts-semantic-quality-audit.json"
FASTEMBED_CACHE = DATA / ".fastembed-cache"
MULTILINGUAL_MODEL = (
    Path.home()
    / ".cache"
    / "huggingface"
    / "hub"
    / "models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2"
    / "snapshots"
    / "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
)
TOKENIZER = TreebankWordTokenizer()
POS_TAG_PREFIXES = {
    "n.": ("NN",),
    "v.": ("VB",),
    "adj.": ("JJ", "VBN", "VBG"),
    "adv.": ("RB",),
}
PROTECTED_SOURCES = {
    "manual-ielts-curation",
    "manual-ielts-final-review",
    "wordnet-example",
}
MODALS = {
    "can",
    "could",
    "may",
    "might",
    "must",
    "shall",
    "should",
    "will",
    "would",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize(vectors):
    matrix = np.asarray(vectors, dtype=np.float32)
    return matrix / np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)


def word_forms(entry):
    word = entry["word"].lower()
    forms = {word}
    morphology = entry.get("morphology") or {}
    for row in (morphology.get("noun") or {}).get("plural", []):
        if row.get("form"):
            forms.add(str(row["form"]).lower())
    for field in ("thirdPerson", "presentParticiple", "past", "pastParticiple"):
        for row in (morphology.get("verb") or {}).get(field, []):
            if row.get("form"):
                forms.add(str(row["form"]).lower())
    return forms


def mask_example(example, forms):
    result = str(example or "")
    for form in sorted(forms, key=len, reverse=True):
        result = re.sub(
            rf"(?<![A-Za-z]){re.escape(form)}(?![A-Za-z])",
            " target ",
            result,
            flags=re.IGNORECASE,
        )
    return re.sub(r"\s+", " ", result).strip()


def tagged_headword_uses(example, forms):
    tokens = TOKENIZER.tokenize(str(example or ""))
    tagged = nltk.pos_tag(tokens)
    matches = []
    for index, (token, tag) in enumerate(tagged):
        normalized = token.lower().strip(".,!?;:'\"()[]{}")
        if normalized not in forms:
            continue
        previous = tagged[index - 1][0].lower() if index else ""
        effective = tag
        if previous == "to" or previous in MODALS:
            effective = "VB"
        matches.append(
            {
                "token": token,
                "tag": tag,
                "effectiveTag": effective,
                "index": index,
                "previousToken": previous,
                "previousTag": tagged[index - 1][1] if index else "",
                "nextToken": tagged[index + 1][0].lower()
                if index + 1 < len(tagged)
                else "",
                "nextTag": tagged[index + 1][1]
                if index + 1 < len(tagged)
                else "",
            }
        )
    return matches


def pos_compatible(expected, use):
    if expected not in POS_TAG_PREFIXES:
        return True
    if any(
        use["effectiveTag"].startswith(prefix)
        for prefix in POS_TAG_PREFIXES.get(expected, ())
    ):
        return True
    if expected == "n.":
        return (
            use["previousTag"] in {"DT", "PRP$", "POS"}
            and not use["nextTag"].startswith("NN")
        )
    if expected == "v.":
        return (
            use["index"] == 0
            and use["nextTag"] in {"DT", "PRP", "PRP$", "JJ", "RB"}
        ) or (
            use["token"].lower().endswith(("ed", "ing"))
            and use["previousTag"] not in {"DT", "PRP$", "POS"}
        )
    if expected == "adj.":
        return use["previousToken"] in {
            "am",
            "are",
            "be",
            "been",
            "being",
            "feel",
            "felt",
            "is",
            "look",
            "looked",
            "seem",
            "seemed",
            "was",
            "were",
        } or use["nextTag"].startswith("NN")
    return False


def main():
    words = read_json(WORDS_PATH)
    all_definitions = []
    all_masked_examples = []
    sense_rows = []
    pos_mismatches = []
    proper_name_collisions = []
    short_examples = []

    for entry in words:
        forms = word_forms(entry)
        for sense in entry.get("senses", []):
            example = str(sense.get("example") or "")
            definition = str(sense.get("definition") or "")
            row = {
                "word": entry["word"],
                "senseId": sense.get("id"),
                "pos": sense.get("pos"),
                "meaning": sense.get("meaning"),
                "definition": definition,
                "example": example,
                "source": sense.get("exampleSource"),
            }
            row["definitionIndex"] = len(all_definitions)
            row["exampleIndex"] = len(all_masked_examples)
            all_definitions.append(definition)
            all_masked_examples.append(mask_example(example, forms))
            sense_rows.append(row)

            lexical_words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", example)
            if len(lexical_words) < 7:
                short_examples.append({**row, "wordCount": len(lexical_words)})

            if " " in entry["word"] or "-" in entry["word"]:
                continue
            uses = tagged_headword_uses(example, forms)
            if (
                sense.get("exampleSource") not in PROTECTED_SOURCES
                and uses
                and not any(pos_compatible(sense.get("pos"), use) for use in uses)
            ):
                pos_mismatches.append({**row, "uses": uses})
            for use in uses:
                if (
                    use["index"] > 0
                    and use["token"][:1].isupper()
                    and use["token"].lower() != entry["word"].lower()
                    and sense.get("pos") not in {"n.", "adj."}
                ):
                    proper_name_collisions.append({**row, "use": use})

    english_model = TextEmbedding(
        model_name="BAAI/bge-small-en-v1.5",
        cache_dir=str(FASTEMBED_CACHE),
    )
    definition_vectors = normalize(
        list(english_model.embed(all_definitions, batch_size=512))
    )
    example_vectors = normalize(
        list(english_model.embed(all_masked_examples, batch_size=512))
    )

    by_word = {}
    for row in sense_rows:
        by_word.setdefault(row["word"], []).append(row)

    example_mismatches = []
    for rows in by_word.values():
        for row in rows:
            example_vector = example_vectors[row["exampleIndex"]]
            target_score = float(
                np.dot(
                    example_vector,
                    definition_vectors[row["definitionIndex"]],
                )
            )
            ranked = sorted(
                (
                    float(
                        np.dot(
                            example_vector,
                            definition_vectors[other["definitionIndex"]],
                        )
                    ),
                    other,
                )
                for other in rows
                if other is not row
            )
            other_score, other = ranked[-1] if ranked else (0.0, None)
            if (
                row["source"] not in PROTECTED_SOURCES
                and other
                and other_score - target_score >= 0.14
                and target_score < 0.48
            ):
                example_mismatches.append(
                    {
                        **row,
                        "targetScore": round(target_score, 4),
                        "otherScore": round(other_score, 4),
                        "closerSenseId": other["senseId"],
                        "closerMeaning": other["meaning"],
                        "margin": round(other_score - target_score, 4),
                    }
                )

    multilingual_model = SentenceTransformer(
        str(MULTILINGUAL_MODEL),
        local_files_only=True,
    )
    meanings = [str(row.get("meaning") or "") for row in sense_rows]
    multilingual_values = meanings + all_definitions
    multilingual_vectors = multilingual_model.encode(
        multilingual_values,
        batch_size=256,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    meaning_vectors = multilingual_vectors[: len(meanings)]
    cross_definition_vectors = multilingual_vectors[len(meanings) :]

    meaning_definition_mismatches = []
    for rows in by_word.values():
        for row in rows:
            row_index = sense_rows.index(row)
            meaning_vector = meaning_vectors[row_index]
            target_score = float(
                np.dot(
                    meaning_vector,
                    cross_definition_vectors[row["definitionIndex"]],
                )
            )
            peers = [other for other in rows if other["pos"] == row["pos"] and other is not row]
            ranked = sorted(
                (
                    float(
                        np.dot(
                            meaning_vector,
                            cross_definition_vectors[other["definitionIndex"]],
                        )
                    ),
                    other,
                )
                for other in peers
            )
            other_score, other = ranked[-1] if ranked else (0.0, None)
            if (
                other
                and other_score - target_score >= 0.18
                and target_score < 0.35
            ):
                meaning_definition_mismatches.append(
                    {
                        **row,
                        "targetScore": round(target_score, 4),
                        "otherScore": round(other_score, 4),
                        "closerSenseId": other["senseId"],
                        "closerMeaning": other["meaning"],
                        "closerDefinition": other["definition"],
                        "margin": round(other_score - target_score, 4),
                    }
                )

    blocking = {
        "properNameCollisions": proper_name_collisions,
        "posMismatches": pos_mismatches,
        "exampleSenseMismatches": example_mismatches,
        "meaningDefinitionMismatches": meaning_definition_mismatches,
    }
    report = {
        "summary": {
            "words": len(words),
            "senses": len(sense_rows),
            "blockingIssues": sum(len(rows) for rows in blocking.values()),
            "blockingIssueCounts": {
                key: len(rows) for key, rows in blocking.items()
            },
            "reviewFlags": len(short_examples),
            "reviewFlagCounts": {
                "shortExamples": len(short_examples),
            },
        },
        "blockingIssues": blocking,
        "reviewFlags": {
            "shortExamples": short_examples,
        },
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
