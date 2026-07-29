import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import wn
from sentence_transformers import SentenceTransformer

from translation_provider import translate_text


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
DICTIONARY_FALLBACKS_PATH = ROOT / "data" / "dictionary-definition-fallbacks.json"
FREE_DICTIONARY_CACHE_PATH = ROOT / "data" / "free-dictionary-cache.json"
MEANING_EN_CACHE_PATH = ROOT / "data" / "meaning-en-cache.json"
TRANSLATION_CACHE_PATH = ROOT / "data" / "argos-en-zh-translation-cache.json"
OVERRIDES_PATH = ROOT / "data" / "sense-definition-overrides.json"
REPORT_PATH = ROOT / "data" / "bilingual-content-repair-report.json"

CJK_RE = re.compile(r"[\u3400-\u9fff]")
PLACEHOLDER_RE = re.compile(
    r"used with the meaning|helpful sentence|needs clue words|generic sentence|"
    r"points? to (?:a|this) (?:specific )?meaning|this (?:use|sense) of|"
    r"to do this action in a specific situation|people use .+ to add detail|"
    r"means to put at a disadvantage",
    re.I,
)
BAD_TRANSLATION_RE = re.compile(
    r"\b(?:To|means|used|meaning|rather|generic|sense|action)\b|"
    r"(?:的意思是|表示|意味着)[^。]{0,16}[A-Za-z]",
    re.I,
)
POS_MAP = {
    "n.": ("noun", "n"),
    "v.": ("verb", "v"),
    "adj.": ("adjective", "a"),
    "adv.": ("adverb", "r"),
    "prep.": ("preposition", None),
    "pron.": ("pronoun", None),
    "conj.": ("conjunction", None),
    "num.": ("numeral", None),
    "int.": ("interjection", None),
    "abbr.": ("abbreviation", None),
}

# Ambiguous polysemes where embedding similarity alone can choose a nearby but
# wrong dictionary sense. These definitions are reviewed against both the
# Chinese gloss and the contextual example.
CURATED_DEFINITIONS = {
    "transaction::manual-2": "An official published record of papers or proceedings from a learned society.",
    "character::manual-1": "The combination of qualities and moral traits that make up a person's nature.",
    "agitate::manual-3": "To campaign actively for social or political change, or to stir people into action.",
    "ban::manual-1": "To officially forbid an activity, product, or action.",
    "bar::manual-1": "A long, rigid piece of wood, metal, or another solid material.",
    "barbecue::manual-3": "An outdoor meal or social gathering at which food is cooked on a grill.",
    "bare::manual-2": "Empty, exposed, or lacking the usual covering, contents, or decoration.",
    "bacterium::manual-1": "A microscopic single-celled organism, some kinds of which cause disease.",
    "principal::manual-3": "The original amount of money borrowed or invested, excluding interest.",
    "proceeding::manual-2": "An event, activity, or sequence of actions carried out in an organized way.",
    "proceeding::manual-3": "A published record of the papers and discussions from a conference or meeting.",
    "account::manual-5": "To form or make up a specified proportion of a total.",
    "gentle::manual-2": "Soft, mild, or gradual rather than strong, rough, or sudden.",
    "spectacle::manual-3": "A pair of lenses in a frame worn to improve or protect a person's sight.",
    "to::manual-1": "Used to indicate movement toward a place, direction, or recipient.",
    "versus::manual-1": "Used to show opposition, competition, or a comparison between two sides.",
    "past::sense-4": "Beyond a place or point, or later than a particular time.",
    "born::manual-1": "Brought into life by birth.",
    "match::manual-3": "A short wooden or cardboard stick that produces a flame when struck.",
    "match::manual-5": "A person or thing equal to, suitable for, or corresponding to another.",
    "round::manual-2": "A stage in a competition, or one complete cycle in a repeated series.",
    "round::manual-4": "One drink served to each person in a group.",
    "round::manual-6": "On every side of, or surrounding, something.",
    "sound::manual-2": "To give a particular impression when heard or described.",
    "address::manual-2": "To deal with a problem, need, or question.",
    "address::manual-3": "To speak formally to a person or an audience.",
    "address::manual-4": "To speak or write to someone using a particular name or title.",
    "vice::sense-2": "Used to indicate that one person or thing replaces another.",
    "mount::manual-6": "A base, bracket, or support on which an object is fixed.",
    "normalization::manual-1": "The process of bringing something back to a normal state or accepted standard.",
    "pickup::manual-3": "An improvement, recovery, or increase in activity.",
    "lest::manual-1": "Used to introduce something that should be prevented or avoided.",
    "vs.::manual-1": "An abbreviation of versus, used for opposition, competition, or comparison.",
    "minus::sense-3": "Used to show that one number or amount is subtracted from another.",
    "sympathise::manual-2": "To agree with or support an idea, aim, or cause.",
    "vapor::manual-1": "A substance in the form of a gas, especially one that is normally a liquid or solid.",
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


def clean_sentence(value):
    text = re.sub(r"\s+", " ", str(value or "").strip())
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    if text[-1] not in ".!?":
        text += "."
    return text


def clean_zh(value):
    text = re.sub(r"\s+", " ", str(value or "").strip())
    text = re.sub(r"\s+([，。；：！？])", r"\1", text)
    if text and text[-1] not in "。！？":
        text += "。"
    return text


def needs_definition_repair(sense):
    value = str(sense.get("definitionSentence", ""))
    return bool(CJK_RE.search(value) or PLACEHOLDER_RE.search(value))


def fetch_dictionary_entry(word):
    url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + urllib.parse.quote(word)
    request = urllib.request.Request(url, headers={"User-Agent": "sense-vocab-build/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.load(response)
        return payload if isinstance(payload, list) else []
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError):
        return []


def ensure_dictionary_cache(words, cache):
    missing = [word for word in words if word not in cache]
    if not missing:
        return cache
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_dictionary_entry, word): word for word in missing}
        for index, future in enumerate(as_completed(futures), 1):
            word = futures[future]
            cache[word] = future.result()
            if index % 25 == 0:
                print(f"dictionary entries: {index}/{len(missing)}", flush=True)
    write_json(FREE_DICTIONARY_CACHE_PATH, cache)
    return cache


def google_translate_one(text, source, target):
    return translate_text(text, source, target, timeout=45)


def translate_batch(values, source, target, cache):
    required = [value for value in dict.fromkeys(values) if value and value not in cache]
    delimiter = " ||| "
    for start in range(0, len(required), 24):
        batch = required[start : start + 24]
        joined = delimiter.join(batch)
        try:
            translated = google_translate_one(joined, source, target)
            parts = re.split(r"\s*\|\|\|\s*", translated)
            if len(parts) != len(batch):
                raise ValueError("translation delimiter count changed")
            cache.update(zip(batch, parts))
        except Exception:
            for value in batch:
                try:
                    cache[value] = google_translate_one(value, source, target)
                except Exception:
                    cache[value] = ""
        print(
            f"translation {source}->{target}: {min(start + len(batch), len(required))}/{len(required)}",
            flush=True,
        )
    return cache


def dictionary_candidates(word, sense, dictionary_cache, dictionary_fallbacks):
    candidates = []
    target_pos, wn_pos = POS_MAP.get(sense.get("pos"), ("", None))
    for entry in dictionary_cache.get(word, []):
        for meaning in entry.get("meanings", []):
            if meaning.get("partOfSpeech", "").lower() != target_pos:
                continue
            for definition in meaning.get("definitions", []):
                candidates.append(str(definition.get("definition", "")))
    for fallback in dictionary_fallbacks.get(word, []):
        if fallback.get("pos") == sense.get("pos"):
            candidates.append(str(fallback.get("definition", "")))
    if sense.get("definition"):
        candidates.append(str(sense["definition"]))
    if wn_pos:
        try:
            candidates.extend(synset.definition() for synset in wn.synsets(word, pos=wn_pos))
        except Exception:
            pass
    cleaned = []
    for candidate in candidates:
        candidate = re.sub(r"\s+", " ", candidate).strip()
        if not candidate or CJK_RE.search(candidate) or len(candidate) > 420:
            continue
        if re.search(r"\(\d{3,4}-\d{2,4}\)", candidate):
            continue
        if candidate.lower() not in {item.lower() for item in cleaned}:
            cleaned.append(candidate)
    return cleaned


def direct_gloss(english_meaning, sense):
    gloss = re.sub(r"\s+", " ", english_meaning).strip().strip(".;")
    if sense.get("pos") == "v." and not gloss.lower().startswith("to "):
        gloss = "to " + gloss[0].lower() + gloss[1:]
    return clean_sentence(gloss)


def select_definitions(items, model, dictionary_cache, dictionary_fallbacks, meaning_cache):
    selected = {}
    low_confidence = []
    for index, item in enumerate(items, 1):
        word = item["word"]
        sense = item["sense"]
        candidates = dictionary_candidates(word, sense, dictionary_cache, dictionary_fallbacks)
        meaning_en = meaning_cache.get(sense.get("meaning", ""), "")
        query = f"Meaning: {meaning_en}. Usage: {sense.get('example', '')}"
        if candidates:
            embeddings = model.encode(
                [query, meaning_en, sense.get("example", "")] + candidates,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            candidate_vectors = embeddings[3:]
            query_scores = candidate_vectors @ embeddings[0]
            meaning_scores = candidate_vectors @ embeddings[1]
            example_scores = candidate_vectors @ embeddings[2]
            scores = 0.45 * query_scores + 0.35 * meaning_scores + 0.20 * example_scores
            best_index = int(np.argmax(scores))
            score = float(scores[best_index])
            definition = clean_sentence(candidates[best_index])
        else:
            score = 0.0
            definition = ""
        if not definition or score < 0.24:
            definition = direct_gloss(meaning_en, sense)
            source = "translated-bilingual-gloss"
        else:
            source = "dictionary-definition"
        if item["key"] in CURATED_DEFINITIONS:
            definition = CURATED_DEFINITIONS[item["key"]]
            source = "human-reviewed-definition"
        selected[item["key"]] = {"definitionSentence": definition, "definitionSource": source}
        if score < 0.34:
            low_confidence.append(
                {
                    "word": word,
                    "sense": sense.get("id"),
                    "pos": sense.get("pos"),
                    "meaning": sense.get("meaning"),
                    "meaningEn": meaning_en,
                    "score": round(score, 3),
                    "definition": definition,
                    "example": sense.get("example"),
                }
            )
        if index % 40 == 0:
            print(f"definition matching: {index}/{len(items)}", flush=True)
    return selected, low_confidence


def main():
    parser = argparse.ArgumentParser(description="Repair mixed-language and placeholder content")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    dictionary_fallbacks = read_json(DICTIONARY_FALLBACKS_PATH, {})
    dictionary_cache = read_json(FREE_DICTIONARY_CACHE_PATH, {})
    meaning_cache = read_json(MEANING_EN_CACHE_PATH, {})
    translation_cache = read_json(TRANSLATION_CACHE_PATH, {})
    overrides = read_json(OVERRIDES_PATH, {})

    repair_items = []
    translation_only_items = []
    for word_entry in words:
        word = word_entry["word"].lower()
        for sense in word_entry.get("senses", []):
            key = f"{word_entry['word']}::{sense.get('id')}"
            item = {"key": key, "word": word, "wordEntry": word_entry, "sense": sense}
            if needs_definition_repair(sense):
                repair_items.append(item)
            elif BAD_TRANSLATION_RE.search(str(sense.get("definitionZh", ""))):
                translation_only_items.append(item)

    if args.fetch:
        dictionary_cache = ensure_dictionary_cache(
            sorted({item["word"] for item in repair_items}),
            dictionary_cache,
        )

    translate_batch(
        [item["sense"].get("meaning", "") for item in repair_items],
        "zh-CN",
        "en",
        meaning_cache,
    )
    write_json(MEANING_EN_CACHE_PATH, meaning_cache)

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    selected, low_confidence = select_definitions(
        repair_items,
        model,
        dictionary_cache,
        dictionary_fallbacks,
        meaning_cache,
    )

    definitions_for_translation = [entry["definitionSentence"] for entry in selected.values()]
    definitions_for_translation.extend(
        item["sense"].get("definitionSentence", "") for item in translation_only_items
    )
    translate_batch(
        definitions_for_translation,
        "en",
        "zh-CN",
        translation_cache,
    )
    write_json(TRANSLATION_CACHE_PATH, translation_cache)

    for item in repair_items:
        key = item["key"]
        sense = item["sense"]
        entry = selected[key]
        translation = clean_zh(translation_cache.get(entry["definitionSentence"], ""))
        if not translation or BAD_TRANSLATION_RE.search(translation):
            translation = clean_zh(sense.get("meaning", ""))
        entry["definitionZh"] = translation
        entry["definitionZhSource"] = "dictionary-translation-build"
        overrides[key] = entry
        if args.write:
            sense.update(entry)

    for item in translation_only_items:
        sense = item["sense"]
        definition = sense.get("definitionSentence", "")
        translation = clean_zh(translation_cache.get(definition, ""))
        if not translation or BAD_TRANSLATION_RE.search(translation):
            translation = clean_zh(sense.get("meaning", ""))
        if args.write:
            sense["definitionZh"] = translation
            sense["definitionZhSource"] = "dictionary-translation-build"

    english_cjk = []
    placeholders = []
    bad_zh = []
    for word_entry in words:
        for sense in word_entry.get("senses", []):
            definition = str(sense.get("definitionSentence", ""))
            if CJK_RE.search(definition):
                english_cjk.append(f"{word_entry['word']}::{sense.get('id')}")
            if PLACEHOLDER_RE.search(definition):
                placeholders.append(f"{word_entry['word']}::{sense.get('id')}")
            if BAD_TRANSLATION_RE.search(str(sense.get("definitionZh", ""))):
                bad_zh.append(f"{word_entry['word']}::{sense.get('id')}")

    report = {
        "summary": {
            "repairedDefinitions": len(repair_items),
            "retranslatedDefinitions": len(translation_only_items),
            "lowConfidence": len(low_confidence),
            "englishCjkRemaining": len(english_cjk),
            "placeholdersRemaining": len(placeholders),
            "badDefinitionTranslationsRemaining": len(bad_zh),
        },
        "lowConfidence": low_confidence,
        "englishCjkRemaining": english_cjk,
        "placeholdersRemaining": placeholders,
        "badDefinitionTranslationsRemaining": bad_zh,
    }
    write_json(OVERRIDES_PATH, overrides)
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)

    if args.write:
        if english_cjk or placeholders or bad_zh:
            raise RuntimeError("Refusing to write unresolved bilingual placeholders")
        write_json(WORDS_PATH, words)


if __name__ == "__main__":
    main()
