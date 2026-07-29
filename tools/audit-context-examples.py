import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
REPORT_PATH = ROOT / "data" / "context-example-audit.json"

BAD_TEXT_RE = re.compile(
    r"helpful sentence|needs clue words|points to a specific meaning|generic sentence|"
    r"in this context|became important in the discussion|"
    r"they decided to \w+ before the meeting ended|"
    r"people use \w+ to add detail|to do this action in a specific situation",
    re.I,
)
DEFINITIONAL_RE = re.compile(
    r"\b(?:means|refers? to|is defined as|can be defined as|is a word for)\b|"
    r"^\s*to\s+[a-z'-]+\s+is\s+to\b|^\s*[a-z'-]+\s+is\s+(?:a|an|the)\b",
    re.I,
)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def normalize(value):
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "", str(value).lower())


def tokens(value):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", str(value).lower())


def morphology_forms(word_entry, sense):
    forms = {word_entry["word"].lower()}
    morphology = word_entry.get("morphology", {}) or {}
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
        pieces = [re.escape(piece) for piece in re.split(r"[-\s]+", form) if piece]
        if pieces and re.search(
            r"(?<![a-z])" + r"[-\s]?".join(pieces) + r"(?![a-z])",
            lowered,
        ):
            return True
    return False


def main():
    words = read_json(WORDS_PATH)
    blocking = defaultdict(list)
    review = defaultdict(list)
    counts = Counter(words=len(words))
    source_counts = Counter()

    for word_entry in words:
        english_seen = set()
        chinese_seen = set()
        for sense in word_entry.get("senses", []):
            forms = morphology_forms(word_entry, sense)
            counts["senses"] += 1
            identity = {"word": word_entry["word"], "sense": sense.get("id")}
            definition = str(sense.get("definitionSentence", "")).strip()
            definition_zh = str(sense.get("definitionZh", "")).strip()
            example = str(sense.get("example", "")).strip()
            example_zh = str(sense.get("exampleZh", "")).strip()
            source = str(sense.get("exampleSource", ""))
            source_counts[source] += 1

            for field, value in (
                ("definitionSentence", definition),
                ("definitionZh", definition_zh),
                ("example", example),
                ("exampleZh", example_zh),
            ):
                if not value:
                    blocking[f"missing_{field}"].append(identity)

            if example and not contains_target(example, forms):
                blocking["targetAbsentFromExample"].append({**identity, "example": example})
            if source.endswith("-adapted"):
                blocking["adaptedSource"].append(identity)
            if BAD_TEXT_RE.search(example) or BAD_TEXT_RE.search(example_zh):
                blocking["placeholderText"].append(identity)
            if word_entry["word"].lower().strip(".") != "means" and DEFINITIONAL_RE.search(example):
                blocking["definitionalExample"].append({**identity, "example": example})
            if normalize(definition) == normalize(example):
                blocking["definitionEqualsExample"].append(identity)
            if example and example[-1] not in '.!?"\'':
                blocking["exampleWithoutTerminalPunctuation"].append(
                    {**identity, "example": example}
                )
            if example_zh and not re.search(r"[\u3400-\u9fff]", example_zh):
                blocking["exampleTranslationWithoutChinese"].append(
                    {**identity, "translation": example_zh}
                )

            english_key = normalize(example)
            chinese_key = normalize(example_zh)
            if english_key in english_seen:
                blocking["duplicateExamplesWithinWord"].append(
                    {**identity, "example": example}
                )
            if chinese_key and chinese_key in chinese_seen:
                blocking["duplicateExampleTranslationsWithinWord"].append(
                    {**identity, "translation": example_zh}
                )
            english_seen.add(english_key)
            if chinese_key:
                chinese_seen.add(chinese_key)

            word_count = len(tokens(example))
            if word_count <= 5:
                review["veryShortExamples"].append({**identity, "example": example})
            if re.match(r"^To\s", example):
                review["infinitiveOpeningExamples"].append({**identity, "example": example})
            if ";" in example or "..." in example or " etc." in example.lower():
                review["dictionaryListExamples"].append({**identity, "example": example})

    report = {
        "summary": {
            **counts,
            "blockingIssues": sum(len(items) for items in blocking.values()),
            "reviewFlags": sum(len(items) for items in review.values()),
        },
        "sourceCounts": dict(source_counts),
        "blockingIssueCounts": {key: len(value) for key, value in blocking.items()},
        "reviewFlagCounts": {key: len(value) for key, value in review.items()},
        "blockingIssues": dict(blocking),
        "reviewFlags": dict(review),
    }
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(json.dumps(report["blockingIssueCounts"], ensure_ascii=False))
    print(json.dumps(report["reviewFlagCounts"], ensure_ascii=False))
    if report["summary"]["blockingIssues"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
