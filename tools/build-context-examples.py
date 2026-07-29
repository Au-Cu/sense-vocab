import argparse
import json
import os
import re
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from lemminflect import getAllInflections, getInflection


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
DICTIONARY_CACHE_PATH = ROOT / "data" / "dictionary-example-cache.json"
REPORT_PATH = ROOT / "data" / "context-example-build-report.json"
OVERRIDES_PATH = ROOT / "data" / "context-example-overrides.jsonl"
DEFINITION_OVERRIDES_PATH = ROOT / "data" / "sense-definition-overrides.json"
WN_DB_PATH = Path.home() / ".wn_data" / "wn.db"
SEMCOR_PATH = Path(tempfile.gettempdir()) / "semcor-corpus" / "semcor"
INDEX_SENSE_PATH = Path(tempfile.gettempdir()) / "wordnet30-corpus" / "wordnet" / "index.sense"

POS_MAP = {
    "n.": "noun",
    "v.": "verb",
    "adj.": "adjective",
    "adv.": "adverb",
    "prep.": "preposition",
    "pron.": "pronoun",
    "conj.": "conjunction",
}
CONTENT_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "being", "by", "for", "from",
    "has", "have", "in", "into", "is", "it", "its", "of", "on", "one", "or",
    "that", "the", "their", "this", "to", "used", "using", "usually", "when",
    "which", "who", "with", "without", "something", "someone", "somebody", "thing",
}
BAD_EXAMPLE_RE = re.compile(
    r"helpful sentence|needs clue words|points to a specific meaning|generic sentence|"
    r"in this context|people use \w+ to add detail|to do this action in a specific situation|"
    r"is an idea, quality, condition, or result|became important in the discussion|"
    r"they decided to \w+ before the meeting ended",
    re.I,
)
DEFINITIONAL_RE = re.compile(
    r"\b(?:means|refers? to|is defined as|can be defined as|is a word for)\b|"
    r"^\s*to\s+[a-z'-]+\s+is\s+to\b|^\s*[a-z'-]+\s+is\s+(?:a|an|the)\b",
    re.I,
)


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_sentence(value):
    text = str(value or "").replace("_", " ").strip()
    text = re.sub(r"\s+([,.;:!?%\)])", r"\1", text)
    text = re.sub(r"([\(\[\{])\s+", r"\1", text)
    text = re.sub(r"\s+(['’]s)\b", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    if text[0].isalpha():
        text = text[0].upper() + text[1:]
    if text[-1] not in ".!?\"'”’":
        text += "."
    return text


def normalized_sentence(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


def tokens(value):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", str(value).lower())


def content_tokens(value):
    result = []
    for token in tokens(value):
        if token in CONTENT_STOPWORDS or len(token) < 3:
            continue
        for suffix in ("ingly", "edly", "ing", "ied", "ies", "ed", "es", "s"):
            if token.endswith(suffix) and len(token) - len(suffix) >= 3:
                token = token[: -len(suffix)] + ("y" if suffix in {"ied", "ies"} else "")
                break
        result.append(token)
    return set(result)


def text_similarity(left, right):
    left_tokens = content_tokens(left)
    right_tokens = content_tokens(right)
    union = left_tokens | right_tokens
    jaccard = len(left_tokens & right_tokens) / len(union) if union else 0
    sequence = SequenceMatcher(None, str(left).lower(), str(right).lower()).ratio()
    return jaccard * 0.72 + sequence * 0.28


def morphology_forms(word_entry, sense):
    forms = {word_entry["word"].lower()}
    morphology = word_entry.get("morphology", {})
    block_names = {
        "n.": ("noun",),
        "v.": ("verb",),
    }.get(sense.get("pos"), ())
    for block_name in block_names:
        block = morphology.get(block_name, {}) or {}
        fields = (
            ("plural",)
            if block_name == "noun"
            else ("thirdPerson", "presentParticiple", "past", "pastParticiple")
        )
        for field in fields:
            for item in block.get(field, []) or []:
                if isinstance(item, dict) and item.get("form"):
                    forms.add(item["form"].lower())
    return forms


def contains_target(sentence, forms):
    if set(tokens(sentence)) & forms:
        return True
    lowered = str(sentence).lower()
    for form in forms:
        cleaned = str(form).lower().strip().strip(".")
        if not cleaned:
            continue
        pieces = [re.escape(piece) for piece in re.split(r"[-\s]+", cleaned) if piece]
        if not pieces:
            continue
        pattern = r"(?<![a-z])" + r"[-\s]?".join(pieces) + r"(?![a-z])"
        if re.search(pattern, lowered, re.I):
            return True
    return False


def preserve_case(source, replacement):
    if source.isupper():
        return replacement.upper()
    if source[:1].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def infer_inflection_tag(lemma, surface, coarse_pos):
    surface_lower = surface.lower().replace(" ", "_")
    for tag, values in getAllInflections(lemma.replace(" ", "_"), upos=None).items():
        if surface_lower in {value.lower() for value in values}:
            return tag
    return {"VB": "VB", "NN": "NN", "JJ": "JJ", "RB": "RB"}.get(coarse_pos, "")


def inflect_like(target, source_lemma, source_surface, coarse_pos=""):
    tag = infer_inflection_tag(source_lemma, source_surface, coarse_pos)
    if tag:
        inflections = getInflection(target, tag=tag)
        if inflections:
            return preserve_case(source_surface, inflections[0])
    return preserve_case(source_surface, target)


def candidate_quality(candidate, word, sense, forms):
    sentence = clean_sentence(candidate["sentence"])
    word_count = len(tokens(sentence))
    if not contains_target(sentence, forms):
        return None
    if word_count < 5 or word_count > 36:
        return None
    if BAD_EXAMPLE_RE.search(sentence):
        return None
    if word.lower().strip(".") != "means" and DEFINITIONAL_RE.search(sentence):
        return None
    if normalized_sentence(sentence) == normalized_sentence(sense.get("definitionSentence", "")):
        return None

    base = {
        "manual-reviewed": 260,
        "manual-function": 260,
        "manual-context-override": 320,
        "dictionary": 155,
        "wordnet-example": 145,
        "semcor": 116,
        "wordnet-example-adapted": 94,
        "semcor-adapted": 82,
    }.get(candidate["source"], 70)
    score = base + candidate.get("definitionSimilarity", 0) * 90
    if 7 <= word_count <= 22:
        score += 20
    elif 5 <= word_count <= 29:
        score += 10
    else:
        score -= (word_count - 29) * 2
    overlap = content_tokens(sentence) & content_tokens(sense.get("definition", ""))
    score += min(15, len(overlap) * 3)
    if sentence.count(",") > 3 or sentence.count(";") > 1:
        score -= 8
    if re.search(r"\b(?:thing|something|anything|everything)\b", sentence, re.I):
        score -= 3
    return {**candidate, "sentence": sentence, "score": round(score, 3)}


def load_index_sense():
    key_to_synset = {}
    synset_to_lemmas = defaultdict(set)
    pos_code = {"1": "n", "2": "v", "3": "a", "4": "r", "5": "s"}
    for line in INDEX_SENSE_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        parts = line.split()
        if len(parts) < 2 or "%" not in parts[0]:
            continue
        sense_key, offset = parts[:2]
        lemma, lexsn = sense_key.split("%", 1)
        pos = pos_code.get(lexsn[:1])
        if not pos:
            continue
        synset_id = f"omw-en-{offset}-{pos}"
        key_to_synset[sense_key] = synset_id
        synset_to_lemmas[synset_id].add(lemma.replace("_", " "))
    return key_to_synset, synset_to_lemmas


def render_elements(elements, replacement_index=None, replacement=""):
    rendered = []
    for index, element in enumerate(elements):
        surface = replacement if index == replacement_index else element["surface"]
        rendered.append(surface.replace("_", " "))
    return clean_sentence(" ".join(rendered))


def collect_semcor_candidates(synset_items, key_to_synset):
    candidates = defaultdict(list)
    for path in SEMCOR_PATH.rglob("*.xml"):
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            continue
        for sentence_element in root.iter("s"):
            elements = []
            for element in list(sentence_element):
                if element.tag not in {"wf", "punc"}:
                    continue
                lemma = str(element.attrib.get("lemma", "")).lower().replace("_", " ")
                lexsn = element.attrib.get("lexsn", "")
                sense_key = f"{lemma.replace(' ', '_')}%{lexsn}" if lemma and lexsn else ""
                elements.append(
                    {
                        "surface": element.text or "",
                        "lemma": lemma,
                        "pos": element.attrib.get("pos", ""),
                        "synset": key_to_synset.get(sense_key, ""),
                    }
                )
            if not elements:
                continue
            original = render_elements(elements)
            for index, element in enumerate(elements):
                synset_id = element["synset"]
                if synset_id not in synset_items:
                    continue
                for item in synset_items[synset_id]:
                    key = item["key"]
                    if len(candidates[key]) >= 30:
                        continue
                    if element["lemma"] == item["word"].lower():
                        candidates[key].append({"sentence": original, "source": "semcor"})
                    elif " " not in item["word"]:
                        replacement = inflect_like(
                            item["word"],
                            element["lemma"],
                            element["surface"],
                            element["pos"],
                        )
                        adapted = render_elements(elements, index, replacement)
                        candidates[key].append(
                            {"sentence": adapted, "source": "semcor-adapted"}
                        )
    return candidates


def direct_example_rows():
    connection = sqlite3.connect(WN_DB_PATH)
    try:
        return connection.execute(
            """
            SELECT synsets.id, synset_examples.example
            FROM synset_examples
            JOIN synsets ON synsets.rowid = synset_examples.synset_rowid
            WHERE synset_examples.lexicon_rowid = 1
            """
        ).fetchall()
    finally:
        connection.close()


def adapt_direct_example(sentence, target, lemmas):
    for lemma in sorted(lemmas, key=len, reverse=True):
        if lemma.lower() == target.lower() or " " in lemma:
            continue
        source_forms = {lemma.lower()}
        form_tags = {}
        for tag, values in getAllInflections(lemma).items():
            for value in values:
                source_forms.add(value.lower())
                form_tags[value.lower()] = tag
        for source_form in sorted(source_forms, key=len, reverse=True):
            match = re.search(rf"\b{re.escape(source_form)}\b", sentence, re.I)
            if not match:
                continue
            replacement = target
            tag = form_tags.get(source_form)
            if tag:
                target_forms = getInflection(target, tag=tag)
                if target_forms:
                    replacement = target_forms[0]
            replacement = preserve_case(match.group(0), replacement)
            return sentence[: match.start()] + replacement + sentence[match.end() :]
    return ""


def collect_direct_candidates(synset_items, synset_to_lemmas):
    candidates = defaultdict(list)
    by_synset = defaultdict(list)
    for synset_id, example in direct_example_rows():
        by_synset[synset_id].append(example)
    for synset_id, items in synset_items.items():
        for item in items:
            for example in by_synset.get(synset_id, []):
                if contains_target(example, item["forms"]):
                    candidates[item["key"]].append(
                        {"sentence": example, "source": "wordnet-example"}
                    )
                    continue
                adapted = adapt_direct_example(
                    example,
                    item["word"],
                    synset_to_lemmas.get(synset_id, set()),
                )
                if adapted and contains_target(adapted, item["forms"] | {item["word"].lower()}):
                    candidates[item["key"]].append(
                        {"sentence": adapted, "source": "wordnet-example-adapted"}
                    )
    return candidates


def collect_dictionary_candidates(words, items_by_word):
    cache = read_json(DICTIONARY_CACHE_PATH, {})
    candidates = defaultdict(list)
    for word_entry in words:
        word = word_entry["word"]
        definitions = []
        for entry in cache.get(word, []):
            for meaning in entry.get("meanings", []):
                pos = meaning.get("partOfSpeech", "").lower()
                for definition in meaning.get("definitions", []):
                    if definition.get("example"):
                        definitions.append(
                            {
                                "pos": pos,
                                "definition": definition.get("definition", ""),
                                "example": definition.get("example", ""),
                            }
                        )
        for item in items_by_word[word]:
            expected_pos = POS_MAP.get(item["sense"].get("pos"), "")
            same_pos_sense_count = sum(
                POS_MAP.get(other["sense"].get("pos"), "") == expected_pos
                for other in items_by_word[word]
            )
            for definition in definitions:
                if definition["pos"] != expected_pos:
                    continue
                similarity = text_similarity(
                    item["sense"].get("definition", ""),
                    definition["definition"],
                )
                minimum_similarity = 0.0 if same_pos_sense_count == 1 else 0.28
                if item["sense"].get("definition") and similarity < minimum_similarity:
                    continue
                if not contains_target(definition["example"], item["forms"]):
                    continue
                candidates[item["key"]].append(
                    {
                        "sentence": definition["example"],
                        "source": "dictionary",
                        "definitionSimilarity": similarity,
                    }
                )
    return candidates


def merge_candidates(*collections):
    merged = defaultdict(list)
    for collection in collections:
        for key, values in collection.items():
            merged[key].extend(values)
    return merged


def collect_override_candidates(items_by_word):
    candidates = defaultdict(list)
    if not OVERRIDES_PATH.exists():
        return candidates
    valid_keys = {
        item["key"]
        for items in items_by_word.values()
        for item in items
    }
    seen = set()
    for line_number, line in enumerate(
        OVERRIDES_PATH.read_text(encoding="utf-8-sig").splitlines(),
        1,
    ):
        if not line.strip():
            continue
        entry = json.loads(line)
        key = f"{entry.get('word')}::{entry.get('sense')}"
        if key not in valid_keys:
            raise ValueError(f"Unknown context override at line {line_number}: {key}")
        if key in seen:
            raise ValueError(f"Duplicate context override at line {line_number}: {key}")
        seen.add(key)
        candidates[key].append(
            {
                "sentence": entry.get("example", ""),
                "source": "manual-context-override",
            }
        )
    return candidates


def build_definition_sentence(word, sense):
    definition = clean_sentence(sense.get("definition", ""))
    if not definition:
        raise ValueError(
            f"No English definition is available for {word}::{sense.get('id')}; "
            "add a reviewed entry to sense-definition-overrides.json"
        )

    definition = definition[0].lower() + definition[1:]
    definition = definition.rstrip(".")
    pos = sense.get("pos", "")
    if pos == "v.":
        return clean_sentence(f"To {word} means to {definition}")
    if pos == "n.":
        if re.match(r"^(?:a|an|the|one|someone|somebody|something|any)\b", definition):
            return clean_sentence(f"{word.capitalize()} is {definition}")
        return clean_sentence(f"{word.capitalize()} refers to {definition}")
    return clean_sentence(f"{word.capitalize()} means {definition}")


def build_definition_translation(word, sense):
    meaning = str(sense.get("meaning", "")).strip().rstrip("。")
    return f"{meaning}。"


def main():
    global WORDS_PATH
    global DICTIONARY_CACHE_PATH
    global REPORT_PATH
    global OVERRIDES_PATH
    global DEFINITION_OVERRIDES_PATH
    parser = argparse.ArgumentParser(description="Build real contextual examples per sense")
    parser.add_argument("--write", action="store_true")
    parser.add_argument(
        "--write-partial",
        action="store_true",
        help="Write audited candidates and leave remaining senses for a later fallback stage.",
    )
    parser.add_argument("--words-path", type=Path, default=WORDS_PATH)
    parser.add_argument("--dictionary-cache-path", type=Path, default=DICTIONARY_CACHE_PATH)
    parser.add_argument("--report-path", type=Path, default=REPORT_PATH)
    parser.add_argument("--overrides-path", type=Path, default=OVERRIDES_PATH)
    parser.add_argument(
        "--definition-overrides-path",
        type=Path,
        default=DEFINITION_OVERRIDES_PATH,
    )
    parser.add_argument("--use-dictionary", action="store_true")
    parser.add_argument("--allow-adapted", action="store_true")
    args = parser.parse_args()
    WORDS_PATH = args.words_path
    DICTIONARY_CACHE_PATH = args.dictionary_cache_path
    REPORT_PATH = args.report_path
    OVERRIDES_PATH = args.overrides_path
    DEFINITION_OVERRIDES_PATH = args.definition_overrides_path

    required_paths = [WN_DB_PATH, SEMCOR_PATH, INDEX_SENSE_PATH]
    missing_paths = [str(path) for path in required_paths if not path.exists()]
    if missing_paths:
        raise FileNotFoundError("Missing corpus data: " + ", ".join(missing_paths))

    words = read_json(WORDS_PATH, [])
    definition_overrides = read_json(DEFINITION_OVERRIDES_PATH, {})
    items_by_word = defaultdict(list)
    synset_items = defaultdict(list)
    all_items = []
    for word_entry in words:
        for sense in word_entry.get("senses", []):
            forms = morphology_forms(word_entry, sense)
            key = f"{word_entry['word']}::{sense.get('id')}"
            item = {
                "key": key,
                "word": word_entry["word"],
                "wordEntry": word_entry,
                "sense": sense,
                "forms": forms,
            }
            all_items.append(item)
            items_by_word[word_entry["word"]].append(item)
            if sense.get("synsetId"):
                synset_items[sense["synsetId"]].append(item)

    key_to_synset, synset_to_lemmas = load_index_sense()
    print("collecting WordNet usage examples", flush=True)
    direct = collect_direct_candidates(synset_items, synset_to_lemmas)
    print("collecting SemCor usage examples", flush=True)
    semcor = collect_semcor_candidates(synset_items, key_to_synset)
    if args.use_dictionary:
        print("collecting same-POS dictionary examples", flush=True)
        dictionary = collect_dictionary_candidates(words, items_by_word)
    else:
        print("skipping untagged dictionary examples", flush=True)
        dictionary = defaultdict(list)
    overrides = collect_override_candidates(items_by_word)
    candidates = merge_candidates(direct, semcor, dictionary, overrides)

    selected = {}
    missing = []
    source_counts = Counter()
    low_confidence = []
    for word_entry in words:
        used_sentences = set()
        for item in items_by_word[word_entry["word"]]:
            sense = item["sense"]
            source = sense.get("exampleSource", "")
            has_override = any(
                candidate.get("source") == "manual-context-override"
                for candidate in candidates.get(item["key"], [])
            )
            if (
                source in {
                    "manual-reviewed",
                    "manual-function",
                    "manual-context-override",
                    "wordnet-example",
                    "semcor",
                }
                and not has_override
            ):
                candidate = candidate_quality(
                    {"sentence": sense.get("example", ""), "source": source},
                    item["word"],
                    sense,
                    item["forms"],
                )
                if candidate:
                    selected[item["key"]] = candidate
                    used_sentences.add(normalized_sentence(candidate["sentence"]))
                    source_counts[candidate["source"]] += 1
                    continue

            ranked = []
            for raw_candidate in candidates.get(item["key"], []):
                if (
                    raw_candidate.get("source", "").endswith("-adapted")
                    and not args.allow_adapted
                ):
                    continue
                candidate = candidate_quality(
                    raw_candidate,
                    item["word"],
                    sense,
                    item["forms"],
                )
                if candidate:
                    ranked.append(candidate)
            ranked.sort(key=lambda candidate: candidate["score"], reverse=True)
            choice = next(
                (
                    candidate
                    for candidate in ranked
                    if normalized_sentence(candidate["sentence"]) not in used_sentences
                ),
                None,
            )
            if not choice:
                missing.append(
                    {
                        "word": item["word"],
                        "sense": sense.get("id"),
                        "pos": sense.get("pos"),
                        "meaning": sense.get("meaning"),
                        "definition": sense.get("definition"),
                        "synsetId": sense.get("synsetId"),
                    }
                )
                continue
            selected[item["key"]] = choice
            used_sentences.add(normalized_sentence(choice["sentence"]))
            source_counts[choice["source"]] += 1
            if choice["score"] < 105:
                low_confidence.append(
                    {
                        "word": item["word"],
                        "sense": sense.get("id"),
                        "meaning": sense.get("meaning"),
                        "source": choice["source"],
                        "score": choice["score"],
                        "example": choice["sentence"],
                    }
                )

    report = {
        "summary": {
            "words": len(words),
            "senses": len(all_items),
            "selected": len(selected),
            "missing": len(missing),
            "lowConfidence": len(low_confidence),
        },
        "sourceCounts": dict(source_counts),
        "missing": missing,
        "lowConfidence": low_confidence,
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)
    print(json.dumps(report["sourceCounts"], ensure_ascii=False), flush=True)

    if args.write or args.write_partial:
        if missing and not args.write_partial:
            raise RuntimeError(
                f"Refusing to write: {len(missing)} senses still lack contextual examples"
            )
        for item in all_items:
            choice = selected.get(item["key"])
            if not choice:
                continue
            sense = item["sense"]
            definition_override = definition_overrides.get(item["key"])
            if definition_override:
                sense.update(definition_override)
            original_source = sense.get("exampleSource")
            if definition_override:
                pass
            elif original_source == "wordnet-definition":
                sense["definitionSentence"] = sense.get("example", "")
                sense["definitionZh"] = sense.get("exampleZh", "")
                sense["definitionSource"] = "wordnet-definition"
            elif not sense.get("definitionSentence"):
                sense["definitionSentence"] = build_definition_sentence(item["word"], sense)
                sense["definitionZh"] = build_definition_translation(item["word"], sense)
                sense["definitionSource"] = "wordnet-gloss"
            sense["example"] = choice["sentence"]
            sense["exampleSource"] = choice["source"]
            sense["exampleQualityScore"] = choice["score"]
            if choice["source"] not in {"manual-reviewed", "manual-function"}:
                sense.pop("exampleZh", None)
                sense.pop("exampleZhSource", None)
        write_json(WORDS_PATH, words)


if __name__ == "__main__":
    main()
