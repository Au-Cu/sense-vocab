import json
import os
import re
import sqlite3
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
DICTIONARY_PATH = ROOT / "data" / "dictionary-definition-fallbacks.json"
SYNSET_CORRECTIONS_PATH = ROOT / "data" / "synset-meaning-corrections.json"
REPORT_PATH = ROOT / "data" / "lexicon-independent-audit.json"
DB_PATH = Path(os.environ.get("WN_DB_PATH", str(Path.home() / ".wn_data" / "wn.db")))

PLACEHOLDER_PATTERNS = (
    r"helpful sentence|stronger sentence|needs (?:surrounding )?clue|points to a specific meaning",
    r"rather than a generic sentence|has a specific sense",
    r"in this context.*means|people use .* to add detail|describes how an action is done",
    r"person connected with this role|tool, machine, or set of things|the child stood .* the door",
)
PLACEHOLDER_RE = re.compile("|".join(PLACEHOLDER_PATTERNS), re.I)
PERSON_RE = re.compile(
    r"人名|姓氏|\b(?:born|died)\s+(?:in\s+)?\d{3,4}\b|\b\d{4}\s*[-–]\s*\d{4}\b",
    re.I,
)
BIOGRAPHY_RE = re.compile(
    r"\b(?:United States|English|British|French|German|Italian|Russian|American)\s+"
    r"(?:actor|actress|writer|poet|artist|composer|politician|president|general|scientist|inventor)\b.*"
    r"\b(?:born|died|\d{4})\b"
    r"|\b(?:teacher|prophet|statesman|physicist|mathematician|philosopher)\b.*\bborn\b"
    r"|\bcirca\b.*\bBC\b.*\bAD\b",
    re.I,
)
STANDARD_POS = {"n.", "v.", "adj.", "adv."}
MORPHOLOGY_FIELDS = ("thirdPerson", "presentParticiple", "past", "pastParticiple")
MORPHOLOGY_EMPHASIS = {"muted", "normal", "special"}
POS_FROM_DB = {"n": "n.", "v": "v.", "a": "adj.", "s": "adj.", "r": "adv."}
STOP = {"a", "an", "the", "to", "of", "and", "or", "in", "on", "with", "for", "is", "are", "be"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def normalize_zh(value):
    return "".join(re.findall(r"[\u4e00-\u9fff]", str(value or "")))


def zh_tokens(value):
    return {normalize_zh(item) for item in re.split(r"[，、,;/；]", value) if normalize_zh(item)}


def english_tokens(value):
    return {item for item in re.findall(r"[a-z]+", value.lower()) if item not in STOP and len(item) > 2}


def lexeme_pattern(word_entry, sense):
    word = word_entry["word"]
    forms = {word.lower()}
    morphology = word_entry.get("morphology", {}) or {}
    if sense.get("pos") == "n.":
        fields = ((morphology.get("noun", {}) or {}).get("plural", []) or [])
    elif sense.get("pos") == "v.":
        verb = morphology.get("verb", {}) or {}
        fields = [
            item
            for field in ("thirdPerson", "presentParticiple", "past", "pastParticiple")
            for item in (verb.get(field, []) or [])
        ]
    else:
        fields = []
    for item in fields:
        if isinstance(item, dict) and item.get("form"):
            forms.add(item["form"].lower())
    variants = [re.escape(form) for form in sorted(forms, key=len, reverse=True)]
    return re.compile(r"(?:^|[^a-z])(?:" + "|".join(variants) + r")(?=$|[^a-z])", re.I)


def audit_form_rows(word, field, rows, issues, allow_special=False):
    if not isinstance(rows, list) or not rows:
        issues["missingMorphologyForms"].append({"word": word, "field": field})
        return
    allowed = MORPHOLOGY_EMPHASIS if allow_special else MORPHOLOGY_EMPHASIS - {"special"}
    for row in rows:
        form = row.get("form", "") if isinstance(row, dict) else ""
        emphasis = row.get("emphasis") if isinstance(row, dict) else None
        valid_spelling = form and all(part.isalpha() for part in form.split("-"))
        if not valid_spelling or emphasis not in allowed:
            issues["invalidMorphologyForms"].append(
                {"word": word, "field": field, "row": row}
            )


def audit_morphology(entry, issues):
    word = entry["word"]
    parts = {sense.get("pos") for sense in entry.get("senses", [])}
    morphology = entry.get("morphology", {})

    if "n." in parts:
        noun = morphology.get("noun")
        if not isinstance(noun, dict):
            issues["missingNounMorphology"].append(word)
        else:
            countability = noun.get("countability")
            plural = noun.get("plural")
            if countability not in {"countable", "uncountable"}:
                issues["invalidNounCountability"].append(word)
            elif countability == "uncountable":
                if plural != []:
                    issues["invalidUncountablePlural"].append(word)
            else:
                audit_form_rows(word, "plural", plural, issues)

    if "v." in parts:
        verb = morphology.get("verb")
        if not isinstance(verb, dict):
            issues["missingVerbMorphology"].append(word)
        elif verb.get("defective"):
            if not isinstance(verb["defective"], str) or not verb["defective"].strip():
                issues["invalidDefectiveVerb"].append(word)
        else:
            for field in MORPHOLOGY_FIELDS:
                audit_form_rows(word, field, verb.get(field), issues)
            for special in verb.get("special", []):
                if not special.get("meaning"):
                    issues["invalidSpecialVerbMorphology"].append(
                        {"word": word, "field": "meaning"}
                    )
                for field in MORPHOLOGY_FIELDS:
                    rows = special.get(field)
                    audit_form_rows(word, field, rows, issues, allow_special=True)
                    if any(row.get("emphasis") != "special" for row in rows or []):
                        issues["invalidSpecialVerbMorphology"].append(
                            {"word": word, "field": field}
                        )


def load_wordnet_evidence():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    lexicons = {row["specifier"]: row["rowid"] for row in connection.execute("SELECT rowid, specifier FROM lexicons")}
    en_id = lexicons["omw-en:2.0"]
    zh_id = lexicons["omw-cmn:2.0"]
    zh_by_ili = defaultdict(set)
    for row in connection.execute(
        """SELECT i.id ili, f.form lemma FROM synsets s
           JOIN ilis i ON i.rowid=s.ili_rowid
           JOIN senses se ON se.synset_rowid=s.rowid
           JOIN entries e ON e.rowid=se.entry_rowid
           JOIN forms f ON f.entry_rowid=e.rowid AND f.rank=0
           WHERE s.lexicon_rowid=? AND e.lexicon_rowid=?""",
        (zh_id, zh_id),
    ):
        zh_by_ili[row["ili"]].add(normalize_zh(row["lemma"]))
    evidence = {}
    for row in connection.execute(
        """WITH first_def AS (
             SELECT synset_rowid, MIN(rowid) definition_rowid FROM definitions
             WHERE lexicon_rowid=? GROUP BY synset_rowid
           )
           SELECT s.id,s.pos,i.id ili,d.definition FROM synsets s
           LEFT JOIN ilis i ON i.rowid=s.ili_rowid
           LEFT JOIN first_def fd ON fd.synset_rowid=s.rowid
           LEFT JOIN definitions d ON d.rowid=fd.definition_rowid
           WHERE s.lexicon_rowid=?""",
        (en_id, en_id),
    ):
        evidence[row["id"]] = {
            "pos": POS_FROM_DB.get(row["pos"]),
            "definition": row["definition"] or "",
            "zh": zh_by_ili.get(row["ili"], set()),
        }
    connection.close()
    return evidence


def near_duplicate(left, right):
    if left.get("pos") != right.get("pos"):
        return False
    left_meaning = zh_tokens(left.get("meaning", ""))
    right_meaning = zh_tokens(right.get("meaning", ""))
    if not (left_meaning & right_meaning):
        return False
    a = left.get("definition", "").lower()
    b = right.get("definition", "").lower()
    ta, tb = english_tokens(a), english_tokens(b)
    jaccard = len(ta & tb) / len(ta | tb) if ta | tb else 0
    return SequenceMatcher(None, a, b).ratio() >= 0.72 or jaccard >= 0.58


def main():
    words = read_json(WORDS_PATH)
    dictionary = read_json(DICTIONARY_PATH)
    synset_corrections = read_json(SYNSET_CORRECTIONS_PATH)
    dictionary_index = {
        (word, row["pos"], row["definition"], row["source"])
        for word, rows in dictionary.items()
        for row in rows
    }
    wordnet = load_wordnet_evidence()
    issues = defaultdict(list)
    review = defaultdict(list)
    provenance = Counter()
    seen_words = set()

    for word in words:
        key = word["word"].lower()
        if key in seen_words:
            issues["duplicateWords"].append(word["word"])
        seen_words.add(key)
        if not word.get("senses"):
            issues["emptyWords"].append(word["word"])
        examples = set()
        meanings = set()
        for sense in word.get("senses", []):
            status = sense.get("auditStatus", "missing")
            provenance[status] += 1
            example = sense.get("example", "").strip()
            example_zh = sense.get("exampleZh", "").strip()
            meaning = sense.get("meaning", "").strip()
            if not example or not meaning or not example_zh:
                issues["emptyFields"].append({"word": word["word"], "sense": sense})
            if example_zh and len(normalize_zh(example_zh)) < 4:
                issues["invalidExampleTranslations"].append({"word": word["word"], "sense": sense})
            if example_zh and PLACEHOLDER_RE.search(example_zh):
                issues["translationPlaceholders"].append({"word": word["word"], "sense": sense})
            if PLACEHOLDER_RE.search(example):
                issues["placeholders"].append({"word": word["word"], "sense": sense})
            if re.search(r"(.)\1{5,}|(.{1,4})\2{3,}", meaning):
                issues["repeatedCharacterRuns"].append({"word": word["word"], "sense": sense})
            if len(meaning) > 160:
                issues["overlongMeanings"].append({"word": word["word"], "sense": sense})
            if any(token in meaning for token in ("�", "鈻", "鐨", "锛", "銆")):
                issues["brokenCharacters"].append({"word": word["word"], "sense": sense})
            if (
                PERSON_RE.search(meaning)
                or PERSON_RE.search(sense.get("definition", ""))
                or BIOGRAPHY_RE.search(sense.get("definition", ""))
            ):
                issues["personNames"].append({"word": word["word"], "sense": sense})
            if not lexeme_pattern(word, sense).search(example):
                issues["missingTargetWord"].append({"word": word["word"], "sense": sense})
            example_key = re.sub(r"\s+", " ", example.lower())
            meaning_key = (sense.get("pos"), normalize_zh(meaning))
            if example_key in examples:
                issues["duplicateExamples"].append({"word": word["word"], "sense": sense})
            if meaning_key in meanings:
                issues["duplicateMeanings"].append({"word": word["word"], "sense": sense})
            examples.add(example_key)
            meanings.add(meaning_key)

            definition = sense.get("definition", "")
            if status == "synset-verified":
                evidence = wordnet.get(sense.get("synsetId"))
                if not evidence or evidence["pos"] != sense.get("pos") or evidence["definition"] != definition:
                    issues["invalidWordnetEvidence"].append({"word": word["word"], "sense": sense})
                meaning_source = sense.get("meaningSource")
                if evidence and meaning_source in {"source-cow-synset-match", "cow-synset-lemmas"}:
                    unmatched = [
                        token
                        for token in zh_tokens(meaning)
                        if not any(
                            token == lemma
                            or token in lemma
                            or lemma in token
                            or f"{token}地" == lemma
                            for lemma in evidence["zh"]
                        )
                    ]
                    if unmatched:
                        issues["invalidChineseWordnetEvidence"].append(
                            {"word": word["word"], "sense": sense, "unmatched": unmatched}
                        )
                if sense.get("meaningSource") == "translated-synset-definition":
                    review["translatedFallbacks"].append({"word": word["word"], "sense": sense})
                elif sense.get("meaningSource") == "human-reviewed-synset-translation":
                    if synset_corrections.get(sense.get("synsetId")) != meaning:
                        issues["invalidSynsetCorrection"].append({"word": word["word"], "sense": sense})
            elif status == "dictionary-verified":
                source_key = (key, sense.get("pos"), definition, sense.get("dictionarySource"))
                if source_key not in dictionary_index:
                    issues["invalidDictionaryEvidence"].append({"word": word["word"], "sense": sense})
            elif status != "human-reviewed":
                issues["unreviewedSenses"].append({"word": word["word"], "sense": sense})

            if sense.get("meaningSource") in {"dictionary-guided-translation", "dictionary-semantic-guided"}:
                candidates = {
                    normalize_zh(token)
                    for item in sense.get("dictionaryCandidates", [])
                    for token in re.split(r"[，、,/]", item)
                }
                meaning_core = normalize_zh(meaning).replace("复数", "")
                if not any(meaning_core and meaning_core in candidate for candidate in candidates):
                    issues["invalidGuidedMeaning"].append({"word": word["word"], "sense": sense})
            elif sense.get("meaningSource") == "translated-dictionary-definition":
                review["translatedDictionaryDefinitions"].append({"word": word["word"], "sense": sense})

        senses = word.get("senses", [])
        for index, left in enumerate(senses):
            for right in senses[index + 1 :]:
                if near_duplicate(left, right):
                    review["nearDuplicateCandidates"].append(
                        {"word": word["word"], "left": left, "right": right}
                    )

        audit_morphology(word, issues)

    report = {
        "summary": {
            "words": len(words),
            "senses": sum(len(word.get("senses", [])) for word in words),
            "blockingIssueCounts": {key: len(value) for key, value in sorted(issues.items())},
            "reviewFlagCounts": {key: len(value) for key, value in sorted(review.items())},
            "provenance": dict(provenance),
        },
        "blockingIssues": dict(issues),
        "reviewFlags": dict(review),
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
