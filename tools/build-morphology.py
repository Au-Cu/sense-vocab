import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from collections import Counter
from pathlib import Path

import mwparserfromhell
from lemminflect import getInflection
from word_forms.word_forms import get_word_forms
from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
OVERRIDES_PATH = ROOT / "data" / "morphology-overrides.json"
WIKTIONARY_CACHE_PATH = ROOT / "data" / "wiktionary-noun-templates.json"
REPORT_PATH = ROOT / "data" / "morphology-audit.json"
USER_AGENT = "SenseVocabMorphology/1.0 (personal study app)"
WIKTIONARY_API = "https://en.wiktionary.org/w/api.php"
FORM_FIELDS = ("thirdPerson", "presentParticiple", "past", "pastParticiple")
INVARIANT_PAST = {
    "bet",
    "bid",
    "broadcast",
    "burst",
    "cast",
    "cost",
    "cut",
    "forecast",
    "hit",
    "hurt",
    "input",
    "let",
    "offset",
    "output",
    "put",
    "quit",
    "read",
    "rid",
    "set",
    "shed",
    "shut",
    "slit",
    "split",
    "spread",
    "thrust",
    "upset",
}


def read_json(path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def chunks(items, size):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def english_section(wikitext):
    match = re.search(
        r"^==English==\s*$\n?(.*?)(?=^==[^=].*?==\s*$|\Z)",
        wikitext,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(1) if match else ""


def noun_templates(wikitext):
    section = english_section(wikitext)
    if not section:
        return []
    parsed = mwparserfromhell.parse(section)
    templates = []
    for template in parsed.filter_templates(recursive=True):
        if str(template.name).strip().lower() != "en-noun":
            continue
        positional = {}
        named = {}
        next_position = 1
        for parameter in template.params:
            name = str(parameter.name).strip()
            value = str(parameter.value).strip()
            if parameter.showkey:
                if name.isdigit():
                    positional[name] = value
                else:
                    named[name] = value
            else:
                positional[str(next_position)] = value
                next_position += 1
        templates.append({"positional": positional, "named": named})
    return templates


def fetch_wiktionary_templates(noun_words, cache):
    missing = [word for word in noun_words if word not in cache]
    if not missing:
        return cache

    total_batches = (len(missing) + 49) // 50
    for batch_number, batch in enumerate(chunks(missing, 50), start=1):
        payload = urllib.parse.urlencode(
            {
                "action": "query",
                "prop": "revisions",
                "rvslots": "main",
                "rvprop": "content",
                "titles": "|".join(batch),
                "format": "json",
                "formatversion": "2",
                "redirects": "1",
            }
        ).encode()
        request = urllib.request.Request(
            WIKTIONARY_API,
            data=payload,
            headers={"User-Agent": USER_AGENT},
        )
        last_error = None
        for attempt in range(6):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    result = json.load(response)
                last_error = None
                break
            except HTTPError as error:
                last_error = error
                if error.code != 429:
                    time.sleep(2 * (attempt + 1))
                    continue
                retry_after = error.headers.get("Retry-After")
                wait_seconds = int(retry_after) if retry_after and retry_after.isdigit() else 20 * (attempt + 1)
                print(f"Wiktionary rate limit; waiting {wait_seconds}s", flush=True)
                time.sleep(wait_seconds)
            except Exception as error:  # Network retry is intentionally broad.
                last_error = error
                time.sleep(3 * (attempt + 1))
        if last_error:
            raise RuntimeError(f"Wiktionary batch failed: {batch[:3]}") from last_error

        resolved = {word: word for word in batch}
        for row in result.get("query", {}).get("normalized", []):
            source = row["from"].lower()
            target = row["to"].lower()
            for word, title in tuple(resolved.items()):
                if title.lower() == source:
                    resolved[word] = target
        for row in result.get("query", {}).get("redirects", []):
            source = row["from"].lower()
            target = row["to"].lower()
            for word, title in tuple(resolved.items()):
                if title.lower() == source:
                    resolved[word] = target

        pages = {}
        for page in result.get("query", {}).get("pages", []):
            if page.get("missing"):
                continue
            revisions = page.get("revisions") or []
            if not revisions:
                continue
            content = revisions[0].get("slots", {}).get("main", {}).get("content", "")
            pages[page.get("title", "").lower()] = noun_templates(content)

        for word in batch:
            cache[word] = pages.get(resolved[word].lower(), [])
        write_json(WIKTIONARY_CACHE_PATH, cache)
        print(f"Wiktionary noun metadata: {batch_number}/{total_batches}", flush=True)
        time.sleep(2.5)
    return cache


def dedupe(values):
    result = []
    seen = set()
    for value in values:
        value = value.strip() if value else ""
        key = value.lower()
        if not value or key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def inflections(word, tag):
    return dedupe(getInflection(word, tag=tag) or ())


def consonant_before_y(word):
    return len(word) > 1 and word.endswith("y") and word[-2] not in "aeiou"


def regular_plural(word):
    if consonant_before_y(word):
        return word[:-1] + "ies"
    if re.search(r"(?:s|x|z|ch|sh)$", word):
        return word + "es"
    return word + "s"


def regular_third_person(word):
    if consonant_before_y(word):
        return word[:-1] + "ies"
    if re.search(r"(?:s|x|z|ch|sh)$", word):
        return word + "es"
    return word + "s"


def regular_present_participle(word):
    if word.endswith("ie"):
        return word[:-2] + "ying"
    if word.endswith(("ee", "oe", "ye")):
        return word + "ing"
    if word.endswith("e"):
        return word[:-1] + "ing"
    return word + "ing"


def regular_past(word):
    if consonant_before_y(word):
        return word[:-1] + "ied"
    if word.endswith("e"):
        return word + "d"
    return word + "ed"


def form_rows(forms, regular_form=None, force_normal=False):
    rows = []
    for form in forms:
        emphasis = "normal" if force_normal or form != regular_form else "muted"
        rows.append({"form": form, "emphasis": emphasis})
    return rows


def template_countability(templates):
    if not templates:
        return None
    first_parameters = [template.get("positional", {}).get("1", "") for template in templates]
    if first_parameters and all(value == "p" for value in first_parameters):
        return "plural-only"
    for template in templates:
        first = template.get("positional", {}).get("1", "")
        if first != "-":
            return "countable"
    return "uncountable"


def noun_morphology(word, templates, overrides):
    key = word.lower()
    if key in overrides["uncountableNouns"]:
        countability = "uncountable"
        countability_source = "manual-override"
    elif key in overrides["countableNouns"]:
        countability = "countable"
        countability_source = "manual-override"
    else:
        countability = template_countability(templates) or "countable"
        countability_source = "wiktionary" if templates else "fallback-countable"

    plural_only = countability == "plural-only"
    if plural_only:
        countability = "countable"

    result = {
        "countability": countability,
        "countabilitySource": countability_source,
        "source": "Wiktionary + LemmInflect",
    }
    if countability == "uncountable":
        result["plural"] = []
        return result

    override_forms = overrides["nounForms"].get(key)
    if plural_only and not override_forms:
        override_forms = [word]
    candidates = dedupe(override_forms or inflections(word, "NNS"))
    if not override_forms:
        noun_family = {
            form.lower()
            for form in get_word_forms(key).get("n", set())
            if re.fullmatch(r"[a-z]+(?:-[a-z]+)?", form.lower())
        }
        raw_candidates = [
            form
            for form in candidates
            if re.fullmatch(r"[A-Za-z]+", form)
        ]
        candidates = raw_candidates[:1]
        candidates.extend(
            form
            for form in raw_candidates[1:]
            if form.lower() in noun_family and zipf_frequency(form, "en") >= 1.0
        )
    allow_invariant = (
        key in overrides["invariantPlurals"]
        or plural_only
        or bool(override_forms and any(form.lower() == key for form in override_forms))
    )
    if not allow_invariant:
        candidates = [form for form in candidates if form.lower() != key]
    if allow_invariant and not any(form.lower() == key for form in candidates):
        candidates.insert(0, word)
    if not candidates:
        candidates = [word if allow_invariant else regular_plural(word)]
    expected = regular_plural(word)
    result["plural"] = form_rows(candidates, expected)
    return result


def verb_morphology(word, overrides):
    key = word.lower()
    if key in overrides["defectiveVerbs"]:
        return {
            "defective": overrides["defectiveVerbs"][key],
            "source": "manual grammar review",
        }
    form_override = overrides["verbForms"].get(key, {})
    standard_forms = {
        form.lower()
        for form in get_word_forms(key).get("v", set())
        if re.fullmatch(r"[a-z]+(?:-[a-z]+)?", form.lower())
    }

    def standard_candidates(field, tag, regular):
        if field in form_override:
            return dedupe(form_override[field])
        raw_candidates = [
            form
            for form in inflections(word, tag)
            if re.fullmatch(r"[a-z]+(?:-[a-z]+)?", form.lower())
            and ("-" in key or "-" not in form)
        ]
        if field in {"past", "pastParticiple"} and key not in INVARIANT_PAST:
            raw_candidates = [form for form in raw_candidates if form.lower() != key]
        candidates = raw_candidates[:1]
        for form in raw_candidates[1:]:
            is_naive_single_consonant = (
                field in {"presentParticiple", "past", "pastParticiple"}
                and form.lower() == regular.lower()
                and candidates
                and re.search(r"([bcdfghjklmnpqrstvwxyz])\1(?:ed|ing)$", candidates[0].lower())
            )
            if (
                form.lower() in standard_forms
                and zipf_frequency(form, "en") >= 1.0
                and not is_naive_single_consonant
            ):
                candidates.append(form)
        return dedupe(candidates)

    third = standard_candidates("thirdPerson", "VBZ", regular_third_person(word))
    present = standard_candidates("presentParticiple", "VBG", regular_present_participle(word))
    past = standard_candidates("past", "VBD", regular_past(word))
    participle = standard_candidates("pastParticiple", "VBN", regular_past(word))

    third = third or [regular_third_person(word)]
    present = present or [regular_present_participle(word)]
    past = past or [regular_past(word)]
    participle = participle or [regular_past(word)]
    past_sets_differ = set(past) != set(participle)

    result = {
        "thirdPerson": form_rows(third, regular_third_person(word)),
        "presentParticiple": form_rows(present, regular_present_participle(word)),
        "past": form_rows(past, regular_past(word), past_sets_differ),
        "pastParticiple": form_rows(participle, regular_past(word), past_sets_differ),
        "source": "LemmInflect",
    }
    special = overrides["specialVerbs"].get(key)
    if special:
        result["special"] = [
            {
                "meaning": row["meaning"],
                **{
                    field: [{"form": row[field], "emphasis": "special"}]
                    for field in FORM_FIELDS
                },
            }
            for row in special
        ]
        result["source"] = "LemmInflect + manual sense review"
    return result


def audit(words, wiktionary_cache):
    issues = []
    stats = Counter()
    valid_emphasis = {"muted", "normal", "special"}
    for entry in words:
        word = entry["word"]
        parts = {sense["pos"] for sense in entry.get("senses", [])}
        morphology = entry.get("morphology", {})
        if "n." in parts:
            stats["nounWords"] += 1
            noun = morphology.get("noun")
            if not noun:
                issues.append({"word": word, "issue": "missing noun morphology"})
            else:
                stats[f"noun.{noun.get('countability')}"] += 1
                stats[f"countabilitySource.{noun.get('countabilitySource')}"] += 1
                if noun.get("countability") not in {"countable", "uncountable"}:
                    issues.append({"word": word, "issue": "invalid countability"})
                plural = noun.get("plural")
                if noun.get("countability") == "uncountable" and plural:
                    issues.append({"word": word, "issue": "uncountable noun has plural"})
                if noun.get("countability") == "countable" and not plural:
                    issues.append({"word": word, "issue": "countable noun lacks plural"})
                for row in plural or []:
                    stats[f"nounForm.{row.get('emphasis')}"] += 1
                    if not row.get("form") or row.get("emphasis") not in valid_emphasis - {"special"}:
                        issues.append({"word": word, "issue": "invalid plural row", "row": row})
                if word.lower() not in wiktionary_cache:
                    issues.append({"word": word, "issue": "missing Wiktionary audit record"})
        if "v." in parts:
            stats["verbWords"] += 1
            verb = morphology.get("verb")
            if not verb:
                issues.append({"word": word, "issue": "missing verb morphology"})
            elif verb.get("defective"):
                stats["defectiveVerbs"] += 1
            else:
                for field in FORM_FIELDS:
                    rows = verb.get(field)
                    if not rows:
                        issues.append({"word": word, "issue": f"missing {field}"})
                    for row in rows or []:
                        stats[f"verbForm.{row.get('emphasis')}"] += 1
                        if not row.get("form") or row.get("emphasis") not in valid_emphasis - {"special"}:
                            issues.append({"word": word, "issue": f"invalid {field}", "row": row})
                for special in verb.get("special", []):
                    stats["specialParadigms"] += 1
                    if not special.get("meaning"):
                        issues.append({"word": word, "issue": "special paradigm lacks meaning"})
                    for field in FORM_FIELDS:
                        rows = special.get(field)
                        if not rows or any(row.get("emphasis") != "special" for row in rows):
                            issues.append({"word": word, "issue": f"invalid special {field}"})
    return {
        "summary": {
            "words": len(words),
            **dict(sorted(stats.items())),
            "wiktionaryNounRecords": len(wiktionary_cache),
            "issueCount": len(issues),
        },
        "issues": issues,
    }


def main():
    global WORDS_PATH
    global OVERRIDES_PATH
    global WIKTIONARY_CACHE_PATH
    global REPORT_PATH
    parser = argparse.ArgumentParser(description="Build audited noun and verb morphology data.")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use cached Wiktionary metadata and mark uncached nouns for local fallback.",
    )
    parser.add_argument(
        "--refresh-fallbacks",
        action="store_true",
        help="Refetch nouns that used fallback-countable in the previous build.",
    )
    parser.add_argument("--words-path", type=Path, default=WORDS_PATH)
    parser.add_argument("--overrides-path", type=Path, default=OVERRIDES_PATH)
    parser.add_argument(
        "--wiktionary-cache-path",
        type=Path,
        default=WIKTIONARY_CACHE_PATH,
    )
    parser.add_argument("--report-path", type=Path, default=REPORT_PATH)
    args = parser.parse_args()
    WORDS_PATH = args.words_path
    OVERRIDES_PATH = args.overrides_path
    WIKTIONARY_CACHE_PATH = args.wiktionary_cache_path
    REPORT_PATH = args.report_path
    words = read_json(WORDS_PATH, [])
    overrides = read_json(OVERRIDES_PATH, {})
    for key in (
        "uncountableNouns",
        "countableNouns",
        "invariantPlurals",
        "nounForms",
        "verbForms",
        "defectiveVerbs",
        "specialVerbs",
    ):
        overrides.setdefault(key, [] if key.endswith("Nouns") or key == "invariantPlurals" else {})
    overrides["uncountableNouns"] = set(overrides["uncountableNouns"])
    overrides["countableNouns"] = set(overrides["countableNouns"])
    overrides["invariantPlurals"] = set(overrides["invariantPlurals"])

    noun_words = sorted(
        entry["word"].lower()
        for entry in words
        if any(sense.get("pos") == "n." for sense in entry.get("senses", []))
    )
    cache = read_json(WIKTIONARY_CACHE_PATH, {})
    if args.refresh_fallbacks:
        fallback_words = {
            entry["word"].lower()
            for entry in words
            if entry.get("morphology", {}).get("noun", {}).get("countabilitySource")
            == "fallback-countable"
        }
        for word in fallback_words:
            cache.pop(word, None)
    if args.offline:
        for word in noun_words:
            cache.setdefault(word, [])
        write_json(WIKTIONARY_CACHE_PATH, cache)
    else:
        cache = fetch_wiktionary_templates(noun_words, cache)

    for entry in words:
        display_word = entry["word"]
        word = display_word.lower()
        parts = {sense.get("pos") for sense in entry.get("senses", [])}
        morphology = {}
        if "n." in parts:
            morphology["noun"] = noun_morphology(display_word, cache.get(word, []), overrides)
        if "v." in parts:
            morphology["verb"] = verb_morphology(display_word, overrides)
        if morphology:
            entry["morphology"] = morphology
        else:
            entry.pop("morphology", None)

    report = audit(words, cache)
    write_json(REPORT_PATH, report)
    if report["issues"]:
        print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
        raise SystemExit(1)
    write_json(WORDS_PATH, words)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
