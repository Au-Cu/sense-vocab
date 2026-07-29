import argparse
import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
from fastembed import TextEmbedding


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
WORDS_PATH = DATA / "ielts-new-words.json"
KAIKKI_PATH = DATA / "ielts-kaikki-cache.json"
REPORT_PATH = DATA / "ielts-kaikki-realignment-audit.json"
MODEL_CACHE = DATA / ".fastembed-cache"
MODEL_NAME = "BAAI/bge-small-en-v1.5"

EXCLUDED_TAGS = {
    "abbreviation",
    "alt-of",
    "alternative",
    "archaic",
    "dated",
    "dialectal",
    "historical",
    "misspelling",
    "nonstandard",
    "obsolete",
    "offensive",
    "rare",
    "regional",
    "slang",
}
PROTECTED_SOURCES = {
    "manual-ielts-curation",
    "manual-ielts-final-review",
}
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
    "for", "from", "has", "have", "in", "is", "it", "its", "of", "on",
    "or", "that", "the", "their", "this", "to", "was", "were", "which",
    "while", "with",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_sentence(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip().strip('"')
    if text and text[-1] not in ".!?":
        text += "."
    return text


def word_forms(entry):
    word = entry["word"].lower()
    forms = {word}
    morphology = entry.get("morphology") or {}
    noun = morphology.get("noun") or {}
    verb = morphology.get("verb") or {}
    for row in noun.get("plural", []):
        if row.get("form"):
            forms.add(str(row["form"]).lower())
    for field in ("thirdPerson", "presentParticiple", "past", "pastParticiple"):
        for row in verb.get(field, []):
            if row.get("form"):
                forms.add(str(row["form"]).lower())
    return forms


def contains_form(sentence, forms):
    lower = sentence.lower()
    return any(
        re.search(rf"(?<![a-z]){re.escape(form)}(?![a-z])", lower)
        for form in forms
    )


def lexical_tokens(value):
    return {
        token
        for token in re.findall(r"[a-z]+(?:'[a-z]+)?", str(value or "").lower())
        if len(token) > 2 and token not in STOPWORDS
    }


def useful_example(sentence, forms):
    text = clean_sentence(sentence)
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text)
    if not 7 <= len(words) <= 32 or not contains_form(text, forms):
        return False
    clues = lexical_tokens(text) - forms
    return len(clues) >= 3


def normalize(vectors):
    matrix = np.asarray(vectors, dtype=np.float32)
    return matrix / np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-12)


def best_example(examples, forms):
    usable = [clean_sentence(example) for example in examples if useful_example(example, forms)]
    if not usable:
        return ""
    return max(
        usable,
        key=lambda value: (
            len(lexical_tokens(value) - forms),
            -abs(len(value.split()) - 15),
        ),
    )


def main():
    parser = argparse.ArgumentParser(
        description="Safely realign IELTS examples to the exact Kaikki/Wiktionary sense."
    )
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    words = read_json(WORDS_PATH)
    kaikki = read_json(KAIKKI_PATH)
    work = []
    texts = set()

    for entry in words:
        forms = word_forms(entry)
        current_by_pos = {}
        for sense in entry.get("senses", []):
            current_by_pos.setdefault(sense.get("pos"), []).append(sense)
            texts.add(str(sense.get("definition") or ""))

        candidates_by_pos = {}
        for source_entry in (kaikki.get(entry["word"], {}) or {}).get("entries", []):
            pos = source_entry.get("pos")
            for source_sense in source_entry.get("senses", []):
                tags = {str(tag).lower() for tag in source_sense.get("tags", [])}
                if tags & EXCLUDED_TAGS:
                    continue
                gloss = next(iter(source_sense.get("glosses", [])), "")
                example = best_example(source_sense.get("examples", []), forms)
                if not gloss or not example:
                    continue
                candidates_by_pos.setdefault(pos, []).append({
                    "gloss": gloss,
                    "example": example,
                    "tags": sorted(tags),
                })
                texts.add(gloss)
        if candidates_by_pos:
            work.append((entry, current_by_pos, candidates_by_pos))

    model = TextEmbedding(model_name=MODEL_NAME, cache_dir=str(MODEL_CACHE))
    ordered = sorted(text for text in texts if text)
    print(f"Embedding {len(ordered)} definitions and Wiktionary glosses...", flush=True)
    vectors = normalize(list(model.embed(ordered, batch_size=512)))
    vector_by_text = dict(zip(ordered, vectors))

    replacements = []
    source_counts = Counter()
    for entry, current_by_pos, candidates_by_pos in work:
        used_examples = {
            clean_sentence(sense.get("example")).lower()
            for senses in current_by_pos.values()
            for sense in senses
            if sense.get("exampleSource") in PROTECTED_SOURCES
        }
        for pos, senses in current_by_pos.items():
            candidates = candidates_by_pos.get(pos, [])
            if not candidates:
                continue
            for sense in senses:
                if sense.get("exampleSource") in PROTECTED_SOURCES:
                    continue
                definition = str(sense.get("definition") or "")
                target = vector_by_text.get(definition)
                if target is None:
                    continue
                ranked = sorted(
                    (
                        (float(np.dot(target, vector_by_text[candidate["gloss"]])), candidate)
                        for candidate in candidates
                        if candidate["example"].lower() not in used_examples
                    ),
                    reverse=True,
                    key=lambda row: row[0],
                )
                if not ranked:
                    continue
                similarity, candidate = ranked[0]
                second = ranked[1][0] if len(ranked) > 1 else 0.0

                other_scores = []
                for other in senses:
                    if other is sense:
                        continue
                    other_definition = str(other.get("definition") or "")
                    other_vector = vector_by_text.get(other_definition)
                    if other_vector is not None:
                        other_scores.append(
                            float(np.dot(other_vector, vector_by_text[candidate["gloss"]]))
                        )
                contrast = similarity - max(other_scores, default=0.0)
                lexical = len(
                    lexical_tokens(definition) & lexical_tokens(candidate["gloss"])
                )
                if len(senses) == 1:
                    accepted = similarity >= 0.90
                else:
                    accepted = (
                        (similarity >= 0.95 and contrast >= 0.03)
                        or (similarity >= 0.90 and contrast >= 0.03)
                    )
                if not accepted:
                    continue
                if len(ranked) > 1 and similarity - second < 0.015 and lexical < 1:
                    continue
                if candidate["example"].lower() == str(sense.get("example") or "").lower():
                    used_examples.add(candidate["example"].lower())
                    continue

                replacements.append({
                    "word": entry["word"],
                    "senseId": sense.get("id"),
                    "pos": pos,
                    "meaning": sense.get("meaning"),
                    "definition": definition,
                    "oldExample": sense.get("example"),
                    "newExample": candidate["example"],
                    "matchedGloss": candidate["gloss"],
                    "similarity": round(similarity, 4),
                    "contrast": round(contrast, 4),
                    "lexicalOverlap": lexical,
                })
                used_examples.add(candidate["example"].lower())
                if args.write:
                    sense["example"] = candidate["example"]
                    sense["exampleZh"] = ""
                    sense["exampleSource"] = "kaikki-wiktionary-realigned"
                    sense["exampleLicense"] = "CC BY-SA 3.0"
                    for field in (
                        "exampleSourceId",
                        "exampleTranslationId",
                        "exampleOwner",
                        "exampleZhSource",
                    ):
                        sense.pop(field, None)
                    source_counts[str(sense.get("exampleSource"))] += 1

    report = {
        "words": len(words),
        "senses": sum(len(entry.get("senses", [])) for entry in words),
        "replacementCount": len(replacements),
        "replacements": replacements,
    }
    write_json(REPORT_PATH, report)
    if args.write:
        write_json(WORDS_PATH, words)
    print(json.dumps({
        "words": report["words"],
        "senses": report["senses"],
        "replacementCount": report["replacementCount"],
        "write": args.write,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
