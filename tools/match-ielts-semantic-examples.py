import argparse
import json
import math
import re
import time
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from fastembed import TextEmbedding
from nltk.corpus import wordnet as wn

try:
    from .batch_content_utils import (
        atomic_write_json,
        peak_rss_bytes,
        sha256_file,
        sha256_json,
        sha256_text,
        utc_now_iso,
    )
    from .semantic_example_matching import (
        EMBEDDING_CACHE_SCHEMA_VERSION,
        embed_texts_with_cache,
        fastembed_model_identity,
        score_candidate_matrix,
    )
except ImportError:
    from batch_content_utils import (
        atomic_write_json,
        peak_rss_bytes,
        sha256_file,
        sha256_json,
        sha256_text,
        utc_now_iso,
    )
    from semantic_example_matching import (
        EMBEDDING_CACHE_SCHEMA_VERSION,
        embed_texts_with_cache,
        fastembed_model_identity,
        score_candidate_matrix,
    )


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEFAULT_WORDS_PATH = DATA / "ielts-new-words.json"
DEFAULT_REPORT_PATH = DATA / "ielts-semantic-example-audit.json"
MODEL_CACHE = DATA / ".fastembed-cache"
MODEL_NAME = "BAAI/bge-small-en-v1.5"
DEFAULT_EMBEDDING_CACHE_DIR = DATA / ".semantic-embedding-cache"
MATCHING_RULES_VERSION = "contrastive-semantic-example-v1"

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


def lexical_overlap(left, right):
    a = lexical_tokens(left)
    b = lexical_tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / math.sqrt(len(a) * len(b))


def audit_result_mapping(selected_rows, rejected_rows):
    selected = [(row["wordId"], row["senseId"]) for row in selected_rows]
    rejected = [(row["wordId"], row["senseId"]) for row in rejected_rows]
    if len(selected) != len(set(selected)):
        raise RuntimeError("Semantic matcher selected the same stable sense more than once")
    if len(rejected) != len(set(rejected)):
        raise RuntimeError("Semantic matcher rejected the same stable sense more than once")
    overlap = set(selected) & set(rejected)
    if overlap:
        raise RuntimeError(
            "Semantic matcher mapped a stable sense to both selected and rejected output"
        )


def main():
    total_started = time.perf_counter()
    parser = argparse.ArgumentParser(
        description="Match unresolved IELTS senses to real examples with contrastive embeddings."
    )
    parser.add_argument("--words-path", type=Path, default=DEFAULT_WORDS_PATH)
    parser.add_argument("--report-path", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument(
        "--embedding-cache-dir",
        type=Path,
        default=DEFAULT_EMBEDDING_CACHE_DIR,
    )
    parser.add_argument("--embedding-batch-size", type=int, default=512)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compatibility flag; this command is always candidate-only",
    )
    args = parser.parse_args()
    if args.embedding_batch_size < 1:
        parser.error("--embedding-batch-size must be positive")

    gather_started = time.perf_counter()
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

    gather_ms = (time.perf_counter() - gather_started) * 1000
    model_started = time.perf_counter()
    try:
        model = TextEmbedding(
            model_name=MODEL_NAME,
            cache_dir=str(MODEL_CACHE),
            local_files_only=True,
        )
    except Exception as error:
        raise RuntimeError(
            "Local embedding provider unavailable; install the approved model "
            f"in {MODEL_CACHE} before running this job"
        ) from error
    model_cold_start_ms = (time.perf_counter() - model_started) * 1000
    ordered_texts = sorted(text for text in texts if text)
    identity_started = time.perf_counter()
    model_identity = fastembed_model_identity(model, MODEL_NAME)
    model_identity_ms = (time.perf_counter() - identity_started) * 1000
    embedding_cache_path = (
        args.embedding_cache_dir
        / f"v{EMBEDDING_CACHE_SCHEMA_VERSION}-{model_identity['assetSha256']}.npz"
    )
    print(
        f"Embedding {len(ordered_texts)} definitions and candidate sentences "
        "with persistent cache...",
        flush=True,
    )
    vector_by_text, embedding_metrics = embed_texts_with_cache(
        model,
        ordered_texts,
        cache_path=embedding_cache_path,
        model_identity=model_identity,
        batch_size=args.embedding_batch_size,
    )

    scoring_started = time.perf_counter()
    selected_rows = []
    rejected_rows = []
    source_counts = Counter()
    for word_entry, unresolved, candidates in work:
        if not candidates:
            rejected_rows.extend(
                {
                    "itemId": f"{word_entry['id']}:{sense.get('id')}:example",
                    "wordId": word_entry["id"],
                    "word": word_entry["word"],
                    "senseId": sense.get("id"),
                    "pos": sense.get("pos"),
                    "synsetId": sense.get("synsetId"),
                    "targetField": "example",
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
        scoring = score_candidate_matrix(
            all_senses,
            candidates,
            vector_by_text,
            synset_example_lookup=synset_examples,
            lexical_overlap=lexical_overlap,
        )
        sense_indexes = {id(sense): index for index, sense in enumerate(all_senses)}
        for sense in unresolved:
            sense_index = sense_indexes[id(sense)]
            if not scoring["validSense"][sense_index]:
                continue
            for candidate_index, candidate in enumerate(candidates):
                sentence_similarity = float(
                    scoring["sentenceSimilarity"][sense_index, candidate_index]
                )
                anchor_similarity = float(
                    scoring["anchorSimilarity"][sense_index, candidate_index]
                )
                score = float(scoring["score"][sense_index, candidate_index])
                contrast = float(scoring["contrast"][sense_index, candidate_index])
                same_synset = bool(
                    scoring["sameSynset"][sense_index, candidate_index]
                )
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
                        "itemId": f"{word_entry['id']}:{sense.get('id')}:example",
                        "wordId": word_entry["id"],
                        "word": word_entry["word"],
                        "senseId": sense.get("id"),
                        "pos": sense.get("pos"),
                        "synsetId": sense.get("synsetId"),
                        "targetField": "example",
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
                    "itemId": f"{word_entry['id']}:{sense.get('id')}:example",
                    "wordId": word_entry["id"],
                    "word": word_entry["word"],
                    "senseId": sense.get("id"),
                    "pos": sense.get("pos"),
                    "synsetId": sense.get("synsetId"),
                    "targetField": "example",
                    "meaning": sense.get("meaning"),
                    "definition": sense.get("definition"),
                    "example": candidate["text"],
                    "exampleZh": candidate["zh"],
                    "candidateMetadata": candidate["metadata"],
                    "source": candidate["source"],
                    "currentValueSha256": sha256_text(
                        str(sense.get("example", ""))
                    ),
                    "candidateValueSha256": sha256_text(candidate["text"]),
                    "inputContextSha256": sha256_json(
                        {
                            "definition": sense.get("definition"),
                            "synsetExamples": synset_examples(sense),
                        }
                    ),
                    "reviewStatus": "pending",
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

    scoring_ms = (time.perf_counter() - scoring_started) * 1000
    audit_started = time.perf_counter()
    audit_result_mapping(selected_rows, rejected_rows)
    for row in selected_rows:
        row.update(
            {
                "resultStatus": "candidate",
                "modelRef": "report:modelIdentity",
                "rulesVersion": MATCHING_RULES_VERSION,
            }
        )
    for row in rejected_rows:
        row.update(
            {
                "resultStatus": "failed",
                "modelRef": "report:modelIdentity",
                "rulesVersion": MATCHING_RULES_VERSION,
            }
        )
    audit_ms = (time.perf_counter() - audit_started) * 1000
    total_ms = (time.perf_counter() - total_started) * 1000
    report = {
        "schemaVersion": 1,
        "kind": "sense-vocab-semantic-example-candidates",
        "status": "candidate-only",
        "approvalRequired": True,
        "generatedAt": utc_now_iso(),
        "rulesVersion": MATCHING_RULES_VERSION,
        "inputFileSha256": sha256_file(args.words_path),
        "model": MODEL_NAME,
        "modelIdentity": model_identity,
        "parameters": {
            "embeddingBatchSize": args.embedding_batch_size,
            "selectionRulesVersion": MATCHING_RULES_VERSION,
        },
        "selected": len(selected_rows),
        "remaining": len(rejected_rows),
        "sourceCounts": dict(source_counts),
        "selectedRows": selected_rows,
        "remainingRows": rejected_rows,
        "metrics": {
            "gatherCandidatesMs": round(gather_ms, 3),
            "modelColdStartMs": round(model_cold_start_ms, 3),
            "modelAssetHashMs": round(model_identity_ms, 3),
            "embedding": embedding_metrics,
            "scoringMs": round(scoring_ms, 3),
            "auditMs": round(audit_ms, 3),
            "totalMs": round(total_ms, 3),
            "peakRssBytes": peak_rss_bytes(),
        },
    }
    report["resultSha256"] = sha256_json(
        {
            "selectedRows": report["selectedRows"],
            "remainingRows": report["remainingRows"],
        }
    )
    atomic_write_json(args.report_path, report)
    print(
        json.dumps(
            {
                "selected": report["selected"],
                "remaining": report["remaining"],
                "sourceCounts": report["sourceCounts"],
                "metrics": report["metrics"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
