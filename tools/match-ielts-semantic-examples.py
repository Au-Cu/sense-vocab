import argparse
import json
import math
import re
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from fastembed import TextEmbedding
from nltk.corpus import wordnet as wn


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEFAULT_WORDS_PATH = DATA / "ielts-new-words.json"
DEFAULT_REPORT_PATH = DATA / "ielts-semantic-example-audit.json"
MODEL_CACHE = DATA / ".fastembed-cache"
MODEL_NAME = "BAAI/bge-small-en-v1.5"

POS_MAP = {
    "noun": "n.",
    "verb": "v.",
    "adjective": "adj.",
    "adverb": "adv.",
}
DISALLOWED_TAGS = {
    "archaic",
    "dated",
    "historical",
    "obsolete",
    "rare",
    "regional",
}
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "hers",
    "him",
    "his",
    "i",
    "in",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "with",
    "you",
    "your",
}
BAD_SENTENCE_RE = re.compile(
    r"\b(?:means|refers? to|is defined as|is a word for|specific meaning|"
    r"generic sentence|in this sense|in this context)\b",
    re.I,
)
LOW_INFORMATION_RE = re.compile(
    r"^(?:this|that|it|he|she|they)\s+(?:is|was|are|were)\s+"
    r"(?:an?\s+)?[a-z'-]+[.!?]?$",
    re.I,
)


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def clean_sentence(value):
    text = re.sub(r"\s+", " ", str(value or "").replace("\\n", " ")).strip()
    text = text.strip(" \"")
    if not text:
        return ""
    text = text[:1].upper() + text[1:]
    if text[-1] not in ".!?":
        text += "."
    return text


def lexical_tokens(value):
    return {
        token
        for token in re.findall(r"[a-z]+(?:'[a-z]+)?", str(value or "").lower())
        if len(token) > 2 and token not in STOPWORDS
    }


def word_forms(word, kaikki_entry):
    forms = {word.lower()}
    if " " not in word and "-" not in word:
        forms.update(
            {
                f"{word.lower()}s",
                f"{word.lower()}es",
                f"{word.lower()}ed",
                f"{word.lower()}ing",
            }
        )
        if word.lower().endswith("y") and len(word) > 2:
            forms.update(
                {
                    f"{word[:-1].lower()}ies",
                    f"{word[:-1].lower()}ied",
                }
            )
        if word.lower().endswith("e"):
            forms.add(f"{word[:-1].lower()}ing")
    for entry in kaikki_entry.get("entries", []) if isinstance(kaikki_entry, dict) else []:
        for row in entry.get("forms", []):
            form = str(row.get("form", "")).strip().lower()
            if form:
                forms.add(form)
    return sorted(forms, key=len, reverse=True)


def contains_form(sentence, forms):
    lower = sentence.lower()
    return any(re.search(rf"(?<![a-z]){re.escape(form)}(?![a-z])", lower) for form in forms)


def sentence_is_usable(sentence, forms):
    text = clean_sentence(sentence)
    if not text or BAD_SENTENCE_RE.search(text) or LOW_INFORMATION_RE.search(text):
        return False
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text)
    if not 5 <= len(words) <= 38 or not contains_form(text, forms):
        return False
    clues = {
        token
        for token in (word.lower() for word in words)
        if len(token) > 2 and token not in STOPWORDS and token not in forms
    }
    return len(clues) >= 2


def direct_chinese_translation(sentence):
    translations = [
        row
        for row in sentence.get("translations", [])
        if row.get("lang") == "cmn"
        and row.get("script") == "Hans"
        and row.get("text")
    ]
    translations.sort(key=lambda row: (not row.get("is_direct"), row.get("id", 0)))
    return clean_sentence(translations[0]["text"]) if translations else ""


@lru_cache(maxsize=None)
def synset_examples_by_id(synset_id):
    match = re.search(r"(\d{8})-([nvars])$", synset_id)
    if not match:
        return []
    try:
        return [
            clean_sentence(example)
            for example in wn.synset_from_pos_and_offset(
                match.group(2),
                int(match.group(1)),
            ).examples()
            if example
        ]
    except Exception:
        return []


def synset_examples(sense):
    return synset_examples_by_id(str(sense.get("synsetId", "")))


def add_candidate(result, seen, sentence, source, anchor="", zh="", metadata=None):
    text = clean_sentence(sentence)
    key = re.sub(r"[^a-z0-9]+", "", text.lower())
    if not key or key in seen:
        return
    seen.add(key)
    result.append(
        {
            "text": text,
            "source": source,
            "anchor": str(anchor or "").strip(),
            "zh": zh,
            "metadata": metadata or {},
        }
    )


def gather_candidates(
    word,
    forms,
    bilingual_entry,
    english_entry,
    kaikki_entry,
    dictionary_entry,
    senses,
):
    candidates = []
    seen = set()

    for row in bilingual_entry.get("data", []) if isinstance(bilingual_entry, dict) else []:
        if sentence_is_usable(row.get("text", ""), forms):
            add_candidate(
                candidates,
                seen,
                row["text"],
                "semantic-tatoeba",
                zh=direct_chinese_translation(row),
                metadata={
                    "exampleSourceId": row.get("id"),
                    "exampleLicense": row.get("license") or "CC BY 2.0 FR",
                    "exampleOwner": row.get("owner"),
                },
            )

    for row in english_entry.get("data", []) if isinstance(english_entry, dict) else []:
        if sentence_is_usable(row.get("text", ""), forms):
            add_candidate(
                candidates,
                seen,
                row["text"],
                "semantic-tatoeba",
                metadata={
                    "exampleSourceId": row.get("id"),
                    "exampleLicense": row.get("license") or "CC BY 2.0 FR",
                    "exampleOwner": row.get("owner"),
                },
            )

    for entry in kaikki_entry.get("entries", []) if isinstance(kaikki_entry, dict) else []:
        pos = POS_MAP.get(entry.get("pos"), entry.get("pos"))
        for kaikkisense in entry.get("senses", []):
            if DISALLOWED_TAGS.intersection(set(kaikkisense.get("tags", []))):
                continue
            anchor = next(iter(kaikkisense.get("glosses", [])), "")
            for sentence in kaikkisense.get("examples", []):
                if sentence_is_usable(sentence, forms):
                    add_candidate(
                        candidates,
                        seen,
                        sentence,
                        "semantic-kaikki-wiktionary",
                        anchor=f"{pos} {anchor}",
                        metadata={"exampleLicense": "CC BY-SA 3.0"},
                    )
            for sentence in kaikkisense.get("quotations", []):
                if sentence_is_usable(sentence, forms):
                    add_candidate(
                        candidates,
                        seen,
                        sentence,
                        "semantic-kaikki-quotation",
                        anchor=f"{pos} {anchor}",
                        metadata={"exampleLicense": "CC BY-SA 3.0"},
                    )

    for entry in dictionary_entry if isinstance(dictionary_entry, list) else []:
        for meaning in entry.get("meanings", []):
            pos = POS_MAP.get(meaning.get("partOfSpeech"), "")
            for definition in meaning.get("definitions", []):
                sentence = definition.get("example", "")
                if sentence_is_usable(sentence, forms):
                    add_candidate(
                        candidates,
                        seen,
                        sentence,
                        "semantic-dictionaryapi-wiktionary",
                        anchor=f"{pos} {definition.get('definition', '')}",
                        metadata={"exampleLicense": "CC BY-SA 3.0"},
                    )

    for sense in senses:
        for sentence in synset_examples(sense):
            if sentence_is_usable(sentence, forms):
                add_candidate(
                    candidates,
                    seen,
                    sentence,
                    "wordnet-example",
                    anchor=sense.get("definition", ""),
                    metadata={
                        "exampleLicense": "WordNet 3.0 license",
                        "exactSynsetId": sense.get("synsetId"),
                    },
                )
    return candidates


def prune_candidates(candidates, senses, limit=14):
    if len(candidates) <= limit:
        return candidates
    ranked = []
    sense_contexts = [
        " ".join(
            [
                str(sense.get("definition", "")),
                *synset_examples(sense),
            ]
        )
        for sense in senses
    ]
    for candidate in candidates:
        candidate_context = f"{candidate['anchor']} {candidate['text']}"
        overlaps = [
            lexical_overlap(context, candidate_context)
            for context in sense_contexts
        ]
        quality = max(overlaps, default=0.0) * 10
        if candidate["anchor"]:
            quality += 1.4
        if candidate["metadata"].get("exactSynsetId"):
            quality += 10
        word_count = len(candidate["text"].split())
        quality += max(0, 1.2 - abs(14 - word_count) * 0.08)
        if candidate["source"] == "semantic-tatoeba":
            quality += 0.4
        ranked.append((quality, candidate))

    retained = []
    retained_ids = set()
    for sense_index in range(len(senses)):
        per_sense = sorted(
            ranked,
            key=lambda row: (
                lexical_overlap(
                    sense_contexts[sense_index],
                    f"{row[1]['anchor']} {row[1]['text']}",
                ),
                row[0],
            ),
            reverse=True,
        )
        for _, candidate in per_sense[:4]:
            identity = id(candidate)
            if identity not in retained_ids:
                retained.append(candidate)
                retained_ids.add(identity)
    for _, candidate in sorted(ranked, key=lambda row: row[0], reverse=True):
        identity = id(candidate)
        if identity not in retained_ids:
            retained.append(candidate)
            retained_ids.add(identity)
        if len(retained) >= limit:
            break
    return retained[: max(limit, len(senses) * 4)]


def normalized_matrix(vectors):
    matrix = np.asarray(vectors, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.maximum(norms, 1e-12)


def safe_cos(left, right):
    return float(np.dot(left, right))


def lexical_overlap(left, right):
    a = lexical_tokens(left)
    b = lexical_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / math.sqrt(len(a) * len(b))


def main():
    parser = argparse.ArgumentParser(
        description="Match unresolved IELTS senses to real examples with contrastive embeddings."
    )
    parser.add_argument("--words-path", type=Path, default=DEFAULT_WORDS_PATH)
    parser.add_argument("--report-path", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    words = read_json(args.words_path, [])
    bilingual = read_json(DATA / "ielts-tatoeba-cache.json", {})
    english = read_json(DATA / "ielts-tatoeba-english-cache.json", {})
    kaikki = read_json(DATA / "ielts-kaikki-cache.json", {})
    dictionary = read_json(DATA / "ielts-dictionary-example-cache.json", {})

    work = []
    texts = set()
    for word_entry in words:
        unresolved = [
            sense for sense in word_entry.get("senses", []) if not sense.get("example")
        ]
        if not unresolved:
            continue
        forms = word_forms(word_entry["word"], kaikki.get(word_entry["word"], {}))
        candidates = gather_candidates(
            word_entry["word"],
            forms,
            bilingual.get(word_entry["word"], {}),
            english.get(word_entry["word"], {}),
            kaikki.get(word_entry["word"], {}),
            dictionary.get(word_entry["word"], []),
            word_entry.get("senses", []),
        )
        candidates = prune_candidates(candidates, word_entry.get("senses", []))
        if not candidates:
            work.append((word_entry, unresolved, []))
            continue
        for sense in word_entry.get("senses", []):
            texts.add(str(sense.get("definition", "")))
            for example in synset_examples(sense):
                texts.add(example)
        for candidate in candidates:
            texts.add(candidate["text"])
            if candidate["anchor"]:
                texts.add(candidate["anchor"])
        work.append((word_entry, unresolved, candidates))

    model = TextEmbedding(model_name=MODEL_NAME, cache_dir=str(MODEL_CACHE))
    ordered_texts = sorted(text for text in texts if text)
    print(f"Embedding {len(ordered_texts)} definitions and candidate sentences...", flush=True)
    vectors = normalized_matrix(list(model.embed(ordered_texts, batch_size=512)))
    vector_by_text = dict(zip(ordered_texts, vectors))

    selected_rows = []
    rejected_rows = []
    source_counts = Counter()
    for word_entry, unresolved, candidates in work:
        if not candidates:
            rejected_rows.extend(
                {
                    "word": word_entry["word"],
                    "senseId": sense.get("id"),
                    "meaning": sense.get("meaning"),
                    "reason": "no-candidates",
                }
                for sense in unresolved
            )
            continue

        all_senses = word_entry.get("senses", [])
        used = {
            re.sub(r"[^a-z0-9]+", "", sense.get("example", "").lower())
            for sense in all_senses
            if sense.get("example")
        }
        proposals = defaultdict(list)
        for sense in unresolved:
            definition = str(sense.get("definition", ""))
            definition_vector = vector_by_text.get(definition)
            if definition_vector is None:
                continue
            wn_examples = synset_examples(sense)
            wn_vectors = [
                vector_by_text[example]
                for example in wn_examples
                if example in vector_by_text
            ]
            for candidate in candidates:
                sentence_vector = vector_by_text[candidate["text"]]
                sentence_similarity = safe_cos(definition_vector, sentence_vector)
                anchor_similarity = sentence_similarity
                if candidate["anchor"] in vector_by_text:
                    anchor_similarity = safe_cos(
                        definition_vector,
                        vector_by_text[candidate["anchor"]],
                    )
                wn_similarity = (
                    max(safe_cos(sentence_vector, vector) for vector in wn_vectors)
                    if wn_vectors
                    else sentence_similarity
                )
                same_synset = (
                    candidate["metadata"].get("exactSynsetId")
                    and candidate["metadata"].get("exactSynsetId") == sense.get("synsetId")
                )
                score = (
                    0.43 * sentence_similarity
                    + 0.47 * anchor_similarity
                    + 0.10 * wn_similarity
                )
                score += min(
                    0.055,
                    lexical_overlap(
                        f"{definition} {' '.join(wn_examples)}",
                        f"{candidate['anchor']} {candidate['text']}",
                    )
                    * 0.08,
                )
                if same_synset:
                    score += 0.14
                if candidate["source"].startswith("semantic-kaikki"):
                    score += 0.015
                if len(candidate["text"].split()) >= 9:
                    score += 0.01

                other_scores = []
                for other in all_senses:
                    if other is sense:
                        continue
                    other_definition = str(other.get("definition", ""))
                    other_vector = vector_by_text.get(other_definition)
                    if other_vector is None:
                        continue
                    other_sentence = safe_cos(other_vector, sentence_vector)
                    other_anchor = (
                        safe_cos(other_vector, vector_by_text[candidate["anchor"]])
                        if candidate["anchor"] in vector_by_text
                        else other_sentence
                    )
                    other_scores.append(0.48 * other_sentence + 0.52 * other_anchor)
                contrast = score - max(other_scores, default=0.0)

                anchored = bool(candidate["anchor"])
                threshold = 0.53 if anchored else 0.47
                minimum_contrast = 0.012 if anchored else 0.026
                accepted = (
                    same_synset
                    or (
                        score >= threshold
                        and (
                            len(all_senses) == 1
                            or contrast >= minimum_contrast
                            or anchor_similarity >= 0.79
                        )
                    )
                )
                if accepted:
                    proposals[sense.get("id")].append(
                        {
                            "sense": sense,
                            "candidate": candidate,
                            "score": score,
                            "contrast": contrast,
                            "sentenceSimilarity": sentence_similarity,
                            "anchorSimilarity": anchor_similarity,
                            "sameSynset": bool(same_synset),
                        }
                    )

        ordered_senses = sorted(
            unresolved,
            key=lambda sense: max(
                (
                    proposal["score"] + max(0, proposal["contrast"])
                    for proposal in proposals.get(sense.get("id"), [])
                ),
                default=-1,
            ),
            reverse=True,
        )
        for sense in ordered_senses:
            options = sorted(
                proposals.get(sense.get("id"), []),
                key=lambda row: (
                    row["sameSynset"],
                    row["score"] + max(0, row["contrast"]),
                ),
                reverse=True,
            )
            selected = next(
                (
                    row
                    for row in options
                    if re.sub(
                        r"[^a-z0-9]+",
                        "",
                        row["candidate"]["text"].lower(),
                    )
                    not in used
                ),
                None,
            )
            if not selected:
                rejected_rows.append(
                    {
                        "word": word_entry["word"],
                        "senseId": sense.get("id"),
                        "meaning": sense.get("meaning"),
                        "reason": "no-confident-unique-match",
                        "candidateCount": len(candidates),
                    }
                )
                continue
            candidate = selected["candidate"]
            key = re.sub(r"[^a-z0-9]+", "", candidate["text"].lower())
            used.add(key)
            source_counts[candidate["source"]] += 1
            selected_rows.append(
                {
                    "word": word_entry["word"],
                    "senseId": sense.get("id"),
                    "meaning": sense.get("meaning"),
                    "definition": sense.get("definition"),
                    "example": candidate["text"],
                    "source": candidate["source"],
                    "score": round(selected["score"], 4),
                    "contrast": round(selected["contrast"], 4),
                    "sentenceSimilarity": round(
                        selected["sentenceSimilarity"],
                        4,
                    ),
                    "anchorSimilarity": round(selected["anchorSimilarity"], 4),
                    "sameSynset": selected["sameSynset"],
                }
            )
            if not args.dry_run:
                sense["example"] = candidate["text"]
                sense["exampleZh"] = candidate["zh"]
                sense["exampleSource"] = candidate["source"]
                sense["exampleQualityScore"] = round(selected["score"] * 100, 2)
                for key_name, value in candidate["metadata"].items():
                    if value is not None:
                        sense[key_name] = value

    report = {
        "model": MODEL_NAME,
        "selected": len(selected_rows),
        "remaining": len(rejected_rows),
        "sourceCounts": dict(source_counts),
        "selectedRows": selected_rows,
        "remainingRows": rejected_rows,
    }
    args.report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not args.dry_run:
        args.words_path.write_text(
            json.dumps(words, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(
        json.dumps(
            {
                "selected": report["selected"],
                "remaining": report["remaining"],
                "sourceCounts": report["sourceCounts"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
