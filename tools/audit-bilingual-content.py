import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
REPORT_PATH = ROOT / "data" / "bilingual-content-audit.json"

CJK_RE = re.compile(r"[\u3400-\u9fff]")
PLACEHOLDER_RE = re.compile(
    r"used with the meaning|helpful sentence|needs clue words|generic sentence|"
    r"points? to (?:a|this) (?:specific )?meaning|"
    r"to do this action in a specific situation|people use .+ to add detail|"
    r"in this context.*means",
    re.I,
)
MALFORMED_ZH_RE = re.compile(
    r"\bTo(?=[\u3400-\u9fff])|"
    r"\bTo[A-Za-z.'-]*(?=\s*(?:\u662f\u6307|\u610f\u5473\u7740|"
    r"\u7684\u610f\u601d|\u8868\u793a|\u610f\u4e3a))",
    re.I,
)
CORPUS_MARKER_RE = re.compile(r"\*\s*\*[A-Za-z]?|\*\s+[A-Za-z]\b")
FIXED_ENGLISH_DEFINITION_RE = re.compile(
    r"^(?:To\s+)?([A-Za-z.'-]+)\s+(?:means|is|refers\s+to)\b",
    re.I,
)
FIXED_CHINESE_PREFIX_RE = re.compile(
    r"^[^，。；：]{1,30}?(?:是指|意味着|(?<!愿)意为|的意思是)\s*"
)


def target_pattern(word):
    return re.compile(
        r"(?<![A-Za-z])" + re.escape(str(word)) + r"(?![A-Za-z])",
        re.I,
    )


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main():
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8-sig"))
    issues = defaultdict(list)
    fields = ("meaning", "definitionSentence", "definitionZh", "example", "exampleZh")
    sense_count = 0
    for word in words:
        examples = {}
        target_re = target_pattern(word["word"])
        for sense in word.get("senses", []):
            sense_count += 1
            key = f"{word['word']}::{sense.get('id')}"
            for field in ("definitionSentence", "example"):
                value = str(sense.get(field, ""))
                if CJK_RE.search(value):
                    issues["englishContainsChinese"].append({"key": key, "field": field})
                if PLACEHOLDER_RE.search(value):
                    issues["placeholders"].append({"key": key, "field": field})
            for field in ("definitionZh", "exampleZh"):
                value = str(sense.get(field, ""))
                if MALFORMED_ZH_RE.search(value):
                    issues["translationArtifacts"].append(
                        {"key": key, "field": field, "value": value}
                    )
                if target_re.search(value):
                    issues["untranslatedTargetInChinese"].append(
                        {"key": key, "field": field, "value": value}
                    )
            if (
                FIXED_ENGLISH_DEFINITION_RE.search(
                    str(sense.get("definitionSentence", ""))
                )
                and FIXED_CHINESE_PREFIX_RE.search(
                    str(sense.get("definitionZh", ""))
                )
            ):
                issues["literalDefinitionPrefixes"].append(
                    {"key": key, "value": sense.get("definitionZh", "")}
                )
            for field in ("definitionSentence", "definitionZh", "example", "exampleZh"):
                value = str(sense.get(field, ""))
                if CORPUS_MARKER_RE.search(value):
                    issues["corpusMarkers"].append(
                        {"key": key, "field": field, "value": value}
                    )
            for field in fields:
                if not str(sense.get(field, "")).strip():
                    issues["missingFields"].append({"key": key, "field": field})
            example_key = re.sub(
                r"\s+",
                " ",
                str(sense.get("example", "")).strip().lower(),
            )
            if example_key in examples:
                issues["duplicateExamples"].append(
                    {"key": key, "duplicateOf": examples[example_key]}
                )
            examples[example_key] = key
            if not str(sense.get("ipa", "")).strip():
                issues["missingIpa"].append({"key": key})

    report = {
        "summary": {
            "words": len(words),
            "senses": sense_count,
            "issueCounts": {key: len(value) for key, value in issues.items()},
            "blockingIssues": sum(len(value) for value in issues.values()),
        },
        "issues": dict(issues),
    }
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False))
    if report["summary"]["blockingIssues"]:
        raise RuntimeError("Bilingual content audit found blocking issues")


if __name__ == "__main__":
    main()
