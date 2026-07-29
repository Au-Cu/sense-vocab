import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WORDS_PATH = DATA_DIR / "ielts-new-words.json"
DICTIONARY_PATH = DATA_DIR / "ielts-dictionary-definition-fallbacks.json"
REPORT_PATH = DATA_DIR / "ielts-final-audit.json"

STANDARD_POS = {
    "n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "num.", "int.", "abbr.",
    "modal.",
}
BLOCKED_SOURCE_RE = re.compile(r"generated|placeholder|template", re.I)
PLACEHOLDER_RE = re.compile(
    r"helpful sentence|needs clue words|generic sentence|points to a specific meaning|"
    r"in this context|this use of|this sense of|people use .* to add detail|"
    r"describes how an action is done|became important in the discussion|"
    r"do this action in a specific situation|the investigation focused on",
    re.I,
)
DEFINITIONAL_EXAMPLE_RE = re.compile(
    r"\b(?:means|is defined as|refers to|is used with the meaning)\b",
    re.I,
)
BIOGRAPHY_RE = re.compile(
    r"\b(?:born|died)\b.*\b\d{3,4}\b|\b\d{3,4}\s*[-–]\s*\d{2,4}\b",
    re.I,
)
TRIVIAL_RE = re.compile(r"^(?:this|that|it)\s+(?:is|was)\s+(?:a|an|the)\b", re.I)
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "for",
    "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
    "that", "the", "their", "this", "to", "was", "were", "which", "while", "with",
}


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def english_tokens(value):
    return {
        token
        for token in re.findall(r"[a-z]+", str(value or "").lower())
        if len(token) > 1 and token not in STOP_WORDS
    }


def definition_similarity(left, right):
    left_tokens = english_tokens(left)
    right_tokens = english_tokens(right)
    lexical = (
        len(left_tokens & right_tokens)
        / max(1, (len(left_tokens) * len(right_tokens)) ** 0.5)
    )
    sequence = SequenceMatcher(
        None,
        re.sub(r"[^a-z0-9]+", " ", str(left or "").lower()).strip(),
        re.sub(r"[^a-z0-9]+", " ", str(right or "").lower()).strip(),
    ).ratio()
    return max(lexical, sequence * 0.55)


def word_forms(entry, sense):
    word = entry["word"].lower()
    forms = {word}
    morphology = entry.get("morphology") or {}
    if sense.get("pos") == "n.":
        rows = (morphology.get("noun") or {}).get("plural", [])
    elif sense.get("pos") == "v.":
        verb = morphology.get("verb") or {}
        rows = [
            row
            for field in ("thirdPerson", "presentParticiple", "past", "pastParticiple")
            for row in verb.get(field, [])
        ]
    else:
        rows = []
    for row in rows:
        if isinstance(row, dict) and row.get("form"):
            forms.add(str(row["form"]).lower())
    if re.fullmatch(r"[a-z]+", word):
        forms.update({f"{word}s", f"{word}es", f"{word}ed", f"{word}ing"})
        if word.endswith("y"):
            forms.update({f"{word[:-1]}ies", f"{word[:-1]}ied"})
        if word.endswith("e"):
            forms.add(f"{word[:-1]}ing")
    return forms


def contains_form(entry, sense, sentence):
    lower = str(sentence or "").lower()
    return any(
        re.search(rf"(?:^|[^a-z]){re.escape(form)}(?:$|[^a-z])", lower)
        for form in sorted(word_forms(entry, sense), key=len, reverse=True)
    )


def has_chinese(value):
    return bool(re.search(r"[\u3400-\u9fff]", str(value or "")))


def latin_terms(value):
    return [
        token
        for token in re.findall(r"[A-Za-z]{3,}", str(value or ""))
        if token.upper() not in {"DNA", "RNA", "UK", "USA"}
    ]


def main():
    words = read_json(WORDS_PATH, [])
    dictionary = read_json(DICTIONARY_PATH, {})
    blocking = defaultdict(list)
    review = defaultdict(list)
    source_counts = Counter()
    word_names = set()

    for entry in words:
        word = entry.get("word", "")
        if word.lower() in word_names:
            blocking["duplicateWords"].append(word)
        word_names.add(word.lower())
        senses = entry.get("senses", [])
        if not senses:
            blocking["emptyWords"].append(word)
            continue
        examples = set()
        for sense in senses:
            identity = {
                "word": word,
                "senseId": sense.get("id"),
                "pos": sense.get("pos"),
                "meaning": sense.get("meaning"),
            }
            source_counts[sense.get("exampleSource") or "missing"] += 1
            required = {
                "pos": sense.get("pos"),
                "meaning": sense.get("meaning"),
                "definition": sense.get("definitionSentence") or sense.get("definition"),
                "definitionZh": sense.get("definitionZh"),
                "example": sense.get("example"),
                "exampleZh": sense.get("exampleZh"),
                "ipa": sense.get("ipa"),
            }
            for field, value in required.items():
                if not str(value or "").strip():
                    blocking[f"missing_{field}"].append(identity)
            if sense.get("pos") not in STANDARD_POS:
                blocking["invalidPos"].append(identity)
            example = str(sense.get("example") or "").strip()
            definition = str(
                sense.get("definitionSentence") or sense.get("definition") or "",
            ).strip()
            if PLACEHOLDER_RE.search(example) or PLACEHOLDER_RE.search(definition):
                blocking["placeholderText"].append(identity)
            if BLOCKED_SOURCE_RE.search(str(sense.get("exampleSource") or "")):
                blocking["generatedExampleSources"].append(identity)
            if DEFINITIONAL_EXAMPLE_RE.search(example):
                blocking["definitionalExamples"].append(identity)
            if TRIVIAL_RE.search(example):
                blocking["trivialExamples"].append(identity)
            if BIOGRAPHY_RE.search(definition) or re.search(r"人名", str(sense.get("meaning") or "")):
                blocking["personNameSenses"].append(identity)
            if example and not contains_form(entry, sense, example):
                blocking["examplesMissingHeadword"].append(identity)
            normalized_example = re.sub(r"\s+", " ", example.lower())
            if normalized_example and normalized_example in examples:
                blocking["duplicateExamplesWithinWord"].append(identity)
            examples.add(normalized_example)
            if (
                normalized_example
                and normalized_example
                == re.sub(r"\s+", " ", definition.lower())
            ):
                blocking["definitionEqualsExample"].append(identity)
            for field in ("definitionZh", "exampleZh"):
                value = str(sense.get(field) or "")
                if value and not has_chinese(value):
                    blocking["translationsWithoutChinese"].append({
                        **identity,
                        "field": field,
                    })
                terms = latin_terms(value)
                if terms:
                    review["latinTermsInTranslations"].append({
                        **identity,
                        "field": field,
                        "terms": terms,
                    })

        by_pos = defaultdict(list)
        for row in dictionary.get(word, []):
            if row.get("pos") in STANDARD_POS and not BIOGRAPHY_RE.search(
                row.get("definition", ""),
            ):
                by_pos[row["pos"]].append(row)
        for pos, rows in by_pos.items():
            for row in rows[:2]:
                if not any(
                    sense.get("pos") == pos
                    and definition_similarity(
                        row["definition"],
                        sense.get("definition", ""),
                    )
                    >= 0.32
                    for sense in senses
                ):
                    review["commonDictionarySenseGaps"].append({
                        "word": word,
                        "pos": pos,
                        "meaning": row.get("meaning"),
                        "definition": row.get("definition"),
                    })

    must_have = {
        "affix": [("n.", r"词缀|语素")],
        "antecedent": [("n.", r"先行词|代词")],
        "baffle": [("v.", r"困惑|迷惑")],
        "batter": [("v.", r"猛打|反复击打|连续击打")],
        "berth": [("n.", r"卧铺|铺位|泊位")],
        "best": [("adj.", r"最好"), ("adv.", r"最好")],
        "better": [("adj.", r"较好|更好"), ("adv.", r"更好")],
        "bill": [("n.", r"账单|帐单"), ("v.", r"开账单|收费")],
        "blink": [("n.", r"眨眼")],
        "blonde": [("adj.", r"金发|浅色")],
        "surname": [("n.", r"姓")],
    }
    word_map = {entry["word"]: entry for entry in words}
    for word, checks in must_have.items():
        entry = word_map.get(word)
        for pos, pattern in checks:
            if not entry or not any(
                sense.get("pos") == pos
                and re.search(pattern, str(sense.get("meaning") or ""))
                for sense in entry.get("senses", [])
            ):
                blocking["knownCommonSenseGaps"].append({
                    "word": word,
                    "pos": pos,
                    "pattern": pattern,
                })

    report = {
        "summary": {
            "words": len(words),
            "senses": sum(len(entry.get("senses", [])) for entry in words),
            "blockingIssues": sum(len(rows) for rows in blocking.values()),
            "reviewFlags": sum(len(rows) for rows in review.values()),
            "blockingIssueCounts": {
                key: len(rows) for key, rows in blocking.items() if rows
            },
            "reviewFlagCounts": {
                key: len(rows) for key, rows in review.items() if rows
            },
            "exampleSourceCounts": dict(source_counts),
        },
        "blockingIssues": dict(blocking),
        "reviewFlags": dict(review),
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if report["summary"]["blockingIssues"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
