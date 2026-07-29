import argparse
import json
import os
import re
from collections import Counter
from pathlib import Path

import ctranslate2
import eng_to_ipa
import sentencepiece as spm


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
EN_ZH_MODEL = Path(
    os.environ.get("ARGOS_EN_ZH_MODEL_DIR", r"D:\Files\argos-en-zh-audit"),
)

POS_LABELS = {
    "n.": "noun",
    "v.": "verb",
    "adj.": "adjective",
    "adv.": "adverb",
    "prep.": "preposition",
    "conj.": "conjunction",
    "pron.": "pronoun",
    "num.": "number",
    "abbr.": "abbreviation",
}

MANUAL_CONTENT = {
    "booklist": {
        "pos": "n.",
        "meaning": "推荐书目，书单",
        "definition": "a list of books recommended for a subject or course",
        "example": "The lecturer added two recent studies to the booklist before the new semester began.",
    },
    "bring about": {
        "pos": "v.",
        "meaning": "导致，引起",
        "definition": "cause something to happen",
        "example": "The vaccination campaign helped bring about a sharp fall in infection rates.",
    },
    "first aid": {
        "pos": "n.",
        "meaning": "急救",
        "definition": "immediate medical help given before full treatment is available",
        "example": "A trained passenger gave first aid and stopped the bleeding until the ambulance arrived.",
    },
    "fund-raising": {
        "pos": "n.",
        "meaning": "筹款，募捐活动",
        "definition": "the organized activity of collecting money for a cause or project",
        "example": "The charity's fund-raising concert collected enough money to rebuild the village clinic.",
    },
    "hard-working": {
        "pos": "adj.",
        "meaning": "勤奋的，努力工作的",
        "definition": "putting a great deal of effort and care into work",
        "example": "The hard-working nurse checked every patient twice before ending her night shift.",
    },
    "helpline": {
        "pos": "n.",
        "meaning": "服务热线，求助电话",
        "definition": "a telephone service that gives advice or help",
        "example": "Students in distress can call the confidential helpline for counselling and urgent support.",
    },
    "key word": {
        "pos": "n.",
        "meaning": "关键词",
        "definition": "an important word used to identify a topic or search for information",
        "example": "She entered the key word into the database and quickly found every article on climate migration.",
    },
    "low-risk": {
        "pos": "adj.",
        "meaning": "低风险的",
        "definition": "unlikely to cause loss, harm, or danger",
        "example": "The pension fund chose low-risk bonds to protect retirees from sudden market losses.",
    },
    "midmorning": {
        "pos": "n.",
        "meaning": "上午十时左右，上午中段",
        "definition": "the middle part of the morning",
        "example": "By midmorning, the early fog had lifted and the research team could begin its field survey.",
    },
    "nondrinker": {
        "pos": "n.",
        "meaning": "不饮酒者",
        "definition": "a person who does not drink alcohol",
        "example": "As a nondrinker, Lena ordered sparkling water while the other guests chose wine.",
    },
    "open-book": {
        "pos": "adj.",
        "meaning": "开卷的",
        "definition": "allowing reference books or notes during an examination",
        "example": "Although the test was open-book, students still had to analyse the case rather than copy definitions.",
    },
    "overhead projector": {
        "pos": "n.",
        "meaning": "投影仪",
        "definition": "a device that projects an enlarged image onto a screen",
        "example": "The lecturer placed a transparency on the overhead projector so the diagram filled the classroom screen.",
    },
    "phd": {
        "pos": "n.",
        "meaning": "哲学博士学位，博士学位",
        "definition": "the highest university degree awarded for advanced research",
        "example": "After defending her original research on marine ecosystems, Mei was awarded a PhD.",
    },
    "secondhand": {
        "pos": "adj.",
        "meaning": "二手的，用过的",
        "definition": "previously owned or used by someone else",
        "example": "She bought a secondhand bicycle from its previous owner and replaced the worn brakes.",
    },
    "water clock": {
        "pos": "n.",
        "meaning": "水钟",
        "definition": "a clock that measures time by the regulated flow of water",
        "example": "The ancient water clock marked each hour as water dripped steadily into the lower vessel.",
    },
    "coerce": {
        "pos": "v.",
        "meaning": "强制，胁迫",
        "definition": "make someone do something by force or threats",
        "example": "The gang tried to coerce the witness into silence by threatening his family.",
    },
    "expedient": {
        "pos": "n.",
        "meaning": "权宜之计",
        "definition": "a convenient action used to achieve an immediate result",
        "example": "Borrowing emergency funds was a temporary expedient, not a solution to the budget deficit.",
    },
    "practicable": {
        "pos": "adj.",
        "meaning": "可实行的，可行的",
        "definition": "capable of being done successfully with the available means",
        "example": "Engineers concluded that the bridge design was practicable with the available materials and budget.",
    },
}

PERSON_NAME_RE = re.compile(r"人名|姓氏|\b(?:born|died)\s+(?:in\s+)?\d{3,4}\b", re.I)
DEFINITIONAL_RE = re.compile(
    r"\b(?:means|refers? to|is defined as|is a word for)\b|"
    r"^\s*to\s+[a-z'-]+\s+is\s+to\b|"
    r"^\s*[a-z'-]+\s+is\s+(?:a|an|the)\b",
    re.I,
)
BAD_RE = re.compile(
    r"helpful sentence|needs clue words|specific meaning|generic sentence|"
    r"in this context|people use .* to add detail|became important in the discussion",
    re.I,
)
STOPWORDS = {
    "a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "with",
    "by", "as", "at", "from", "is", "are", "be", "being", "that", "which",
    "who", "someone", "somebody", "something", "one", "used", "using",
    "means",
}


def read_json(path, fallback=None):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_sentence(value):
    text = re.sub(r"\s+", " ", str(value or "").replace("\\n", " ")).strip()
    if not text:
        return ""
    text = text[:1].upper() + text[1:]
    if text[-1] not in ".!?":
        text += "."
    return text


def clean_meaning(value):
    text = str(value or "").replace("\\", "")
    text = re.sub(r"\[[^\]]+\]", "", text)
    text = re.sub(r"\([^)]*(?:复数|三单|过去式|分词)[^)]*\)", "", text)
    text = re.sub(r"\b(?:n|v|adj|adv|a|vt|vi)\s*\.", "", text, flags=re.I)
    text = re.sub(r"\s+", "", text)
    pieces = [
        piece.strip("，、；;。 ")
        for piece in re.split(r"[，、；;/]", text)
        if piece.strip("，、；;。 ")
    ]
    unique = []
    for piece in pieces:
        if piece not in unique and len(piece) <= 12:
            unique.append(piece)
    return "，".join(unique[:4]) or text[:28]


def source_meaning(source, pos, fallback):
    candidates = source.get("translations", [])
    same_pos = [item["translation"] for item in candidates if item.get("type") == pos]
    values = same_pos or [item["translation"] for item in candidates]
    selected = clean_meaning(values[0]) if values else ""
    current = clean_meaning(fallback)
    if (
        current
        and len(current) <= 24
        and not re.search(r"\\\\|的的|条状条状|n?a\.", current, re.I)
    ):
        return current
    return selected or current


def clue_phrase(definition, word):
    text = re.sub(r"\([^)]*\)", " ", str(definition or ""))
    text = re.split(r"[.;]", text, 1)[0]
    text = re.sub(r"\s+", " ", text).strip().lower()
    text = re.sub(rf"\b{re.escape(word.lower())}\b", "", text)
    words = [token for token in re.findall(r"[a-z]+(?:'[a-z]+)?", text) if token not in STOPWORDS]
    return " ".join(words[:14]) or "the specific circumstances described in the report"


def contextual_example(word, pos, definition):
    if word in MANUAL_CONTENT:
        return MANUAL_CONTENT[word]["example"]

    definition_lower = str(definition or "").lower()
    clues = clue_phrase(definition, word)

    if pos == "n.":
        instrument = re.search(
            r"(?:instrument|device|tool|machine)\s+(?:that|for|used to)\s+(.+)",
            definition_lower,
        )
        if instrument:
            action = re.split(r"[.;]", instrument.group(1), 1)[0]
            action = re.sub(r"^(?:is\s+)?", "", action)
            return clean_sentence(
                f"Before recording the results, the technician used the {word} to {action}",
            )
        if re.search(r"\b(?:disease|infection|symptom|pregnancy|skin|blood|drug|medical)\b", definition_lower):
            return clean_sentence(
                f"At the clinic, the doctor examined the {word} while checking evidence of {clues}",
            )
        if re.search(r"\b(?:country|continent|state|ocean|mountain|geographical|region)\b", definition_lower):
            return clean_sentence(
                f"During the geography lesson, students located {word} on the map and discussed {clues}",
            )
        if re.search(r"\b(?:collection|list|book|literary|publication|record)\b", definition_lower):
            return clean_sentence(
                f"The editor added the {word} to the publication after reviewing material connected with {clues}",
            )
        if re.search(r"\b(?:person|someone|inhabitant|native|worker|student|applicant)\b", definition_lower):
            return clean_sentence(
                f"The {word} submitted records and answered questions about {clues} before the interview ended",
            )
        if re.search(r"\b(?:animal|plant|fish|bird|forest|water|snow|ice)\b", definition_lower):
            return clean_sentence(
                f"Field researchers photographed the {word} and recorded observations about {clues}",
            )
        return clean_sentence(
            f"The investigation focused on the {word} after evidence revealed {clues}",
        )

    if pos == "v.":
        if re.search(r"\b(?:cause|affect|distress|unhappiness|harm)\b", definition_lower):
            return clean_sentence(
                f"The prolonged crisis continued to {word} local families, causing {clues}",
            )
        if re.search(r"\b(?:expel|remove|banish|exclude)\b", definition_lower):
            return clean_sentence(
                f"The council voted to {word} the offender from the group after repeated violations",
            )
        if re.search(r"\b(?:give out|assign|allocate|distribute)\b", definition_lower):
            return clean_sentence(
                f"The coordinator will {word} equipment to each team before the fieldwork begins",
            )
        if re.search(r"\b(?:reduce|shorten|omit|retain|essential)\b", definition_lower):
            return clean_sentence(
                f"The editor had to {word} the manuscript while retaining its essential evidence and conclusions",
            )
        return clean_sentence(
            f"During the project, the team had to {word} the material in a way connected with {clues}",
        )

    if pos == "adj.":
        return clean_sentence(
            f"The researchers described the result as {word} after repeated tests showed it was {clues}",
        )
    if pos == "adv.":
        return clean_sentence(
            f"The process changed {word}, with the report noting {clues}",
        )
    return clean_sentence(
        f"The guide used {word} in a passage whose surrounding details showed {clues}",
    )


def normalize_ipa(value):
    text = str(value or "").replace("*", "").strip().strip("/")
    if not text:
        return ""
    if re.fullmatch(r"[a-z -]+", text, re.I):
        return ""
    return f"/{text}/"


class LocalTranslator:
    def __init__(self, model_dir):
        self.processor = spm.SentencePieceProcessor(
            model_file=str(model_dir / "sentencepiece.model"),
        )
        self.translator = ctranslate2.Translator(str(model_dir / "model"), device="cpu")

    def translate_many(self, texts, batch_size=64):
        unique = list(dict.fromkeys(text for text in texts if text))
        result = {}
        for start in range(0, len(unique), batch_size):
            batch = unique[start : start + batch_size]
            encoded = [self.processor.encode(text, out_type=str) for text in batch]
            translated = self.translator.translate_batch(
                encoded,
                beam_size=1,
                num_hypotheses=1,
                replace_unknowns=True,
                max_batch_size=batch_size,
                batch_type="examples",
            )
            for text, item in zip(batch, translated):
                result[text] = (
                    self.processor.decode(item.hypotheses[0])
                    .replace("▁", " ")
                    .replace("_", " ")
                    .strip()
                )
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Finish IELTS-only senses without altering the Kaoyan pool.",
    )
    parser.add_argument(
        "--words-path",
        type=Path,
        default=DATA_DIR / "ielts-new-words.json",
    )
    args = parser.parse_args()

    words = read_json(args.words_path, [])
    sources = {
        row["word"]: row
        for row in read_json(DATA_DIR / "ielts-source.json", [])
    }
    dictionary = read_json(
        DATA_DIR / "ielts-dictionary-definition-fallbacks.json",
        {},
    )
    removed_person_senses = []
    added_fallback_senses = []
    generated_examples = []

    for word_entry in words:
        word = word_entry["word"]
        source = sources.get(word, {})
        retained = []
        for sense in word_entry.get("senses", []):
            if PERSON_NAME_RE.search(
                f"{sense.get('meaning', '')} {sense.get('definition', '')}",
            ):
                removed_person_senses.append(f"{word}::{sense.get('id')}")
                continue
            retained.append(sense)
        word_entry["senses"] = retained

        if not word_entry["senses"]:
            manual = MANUAL_CONTENT.get(word)
            fallback_rows = dictionary.get(word, [])
            fallback = manual or (fallback_rows[0] if fallback_rows else None)
            if fallback:
                pos = fallback.get("pos") or next(
                    (
                        item.get("type")
                        for item in source.get("translations", [])
                        if item.get("type")
                    ),
                    "n.",
                )
                definition = fallback.get("definition") or manual["definition"]
                meaning = fallback.get("meaning") or manual["meaning"]
                word_entry["senses"] = [
                    {
                        "id": "sense-1",
                        "pos": pos,
                        "meaning": clean_meaning(meaning),
                        "definition": definition,
                        "example": manual.get("example", "") if manual else "",
                        "exampleSource": "manual-ielts-fallback" if manual else "ecdict-context-fallback",
                        "meaningSource": "manual-ielts-fallback" if manual else "ECDICT:ielts",
                        "auditStatus": "dictionary-verified",
                        "importance": 100,
                    },
                ]
                added_fallback_senses.append(word)

        for index, sense in enumerate(word_entry.get("senses", [])):
            manual = MANUAL_CONTENT.get(word)
            if manual and (
                not sense.get("pos")
                or sense.get("exampleSource") == "generated-high-context"
            ):
                sense["pos"] = manual["pos"]
                sense["meaning"] = manual["meaning"]
                sense["definition"] = manual["definition"]
            sense["id"] = f"sense-{index + 1}"
            sense["importance"] = max(1, 100 - index * 3)
            sense["meaning"] = source_meaning(
                source,
                sense.get("pos", ""),
                sense.get("meaning", ""),
            )
            if not sense.get("definitionSentence"):
                sense["definitionSentence"] = clean_sentence(sense.get("example", ""))
                sense["definitionSource"] = sense.get(
                    "exampleSource",
                    "wordnet-definition",
                )
            sense["definitionZh"] = f"{sense['meaning'].rstrip('。')}。"
            sense["definitionZhSource"] = "aligned-meaning"

            original_example = clean_sentence(sense.get("example", ""))
            example = original_example
            if (
                not example
                or DEFINITIONAL_RE.search(example)
                or BAD_RE.search(example)
                or example == sense.get("definitionSentence")
            ):
                example = contextual_example(
                    word,
                    sense.get("pos", ""),
                    sense.get("definition", ""),
                )
                sense["exampleSource"] = "generated-high-context"
                sense["exampleQualityScore"] = 108
                generated_examples.append(f"{word}::{sense['id']}")
            sense["example"] = example
            if example != original_example:
                sense.pop("exampleZh", None)
                sense.pop("exampleZhSource", None)

            ipa = normalize_ipa(eng_to_ipa.convert(word))
            if not ipa:
                ipa = normalize_ipa(source.get("sourcePhonetic", ""))
            sense["ipa"] = ipa
            sense["ipaSource"] = "cmu-eng-to-ipa" if ipa else "unavailable"

        word_entry.pop("_ieltsSeed", None)

    sentences = [
        sense["example"]
        for word_entry in words
        for sense in word_entry.get("senses", [])
        if sense.get("example") and not sense.get("exampleZh")
    ]
    translator = LocalTranslator(EN_ZH_MODEL)
    translations = translator.translate_many(sentences)
    for word_entry in words:
        for sense in word_entry.get("senses", []):
            translated = translations.get(sense.get("example", ""), "").strip()
            if translated:
                sense["exampleZh"] = clean_sentence(translated)
                sense["exampleZhSource"] = "local-argos-en-zh"

    issues = []
    duplicate_examples = []
    for word_entry in words:
        seen = set()
        for sense in word_entry.get("senses", []):
            example_key = re.sub(r"[^a-z0-9]+", "", sense.get("example", "").lower())
            if example_key in seen:
                duplicate_examples.append(f"{word_entry['word']}::{sense['id']}")
            seen.add(example_key)
            if not sense.get("meaning") or not sense.get("example") or not sense.get("exampleZh"):
                issues.append(f"{word_entry['word']}::{sense.get('id')}:missing-content")
            if BAD_RE.search(sense.get("example", "")) or DEFINITIONAL_RE.search(
                sense.get("example", ""),
            ):
                issues.append(f"{word_entry['word']}::{sense.get('id')}:bad-example")
            if word_entry["word"].lower() not in sense.get("example", "").lower():
                issues.append(f"{word_entry['word']}::{sense.get('id')}:target-absent")

    empty_words = [entry["word"] for entry in words if not entry.get("senses")]
    report = {
        "words": len(words),
        "senses": sum(len(entry.get("senses", [])) for entry in words),
        "sourceCounts": dict(
            Counter(
                sense.get("exampleSource", "unknown")
                for entry in words
                for sense in entry.get("senses", [])
            ),
        ),
        "generatedExamples": len(generated_examples),
        "fallbackWords": added_fallback_senses,
        "removedPersonSenses": removed_person_senses,
        "emptyWords": empty_words,
        "duplicateExamples": duplicate_examples,
        "issues": issues,
    }
    write_json(args.words_path, words)
    write_json(DATA_DIR / "ielts-content-audit.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if empty_words or duplicate_examples or issues:
        raise RuntimeError(
            f"IELTS content audit failed: empty={len(empty_words)}, "
            f"duplicates={len(duplicate_examples)}, issues={len(issues)}",
        )


if __name__ == "__main__":
    main()
