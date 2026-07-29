import argparse
import json
import re
from pathlib import Path

import ctranslate2
import sentencepiece as spm


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WORDS_PATH = DATA_DIR / "ielts-new-words.json"
CACHE_PATH = DATA_DIR / "ielts-translation-cache.json"
REPORT_PATH = DATA_DIR / "ielts-translation-audit.json"
MODEL_DIR = Path(r"D:\Files\argos-en-zh-audit")


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_translation(value):
    text = str(value or "").replace("▁", " ").replace("_", " ").strip()
    text = re.sub(r"\s+([，。！？；：、）])", r"\1", text)
    text = re.sub(r"([（])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace(",", "，").replace(";", "；")
    text = re.sub(r"\.(?=$)", "。", text)
    text = re.sub(r"\?(?=$)", "？", text)
    text = re.sub(r"!(?=$)", "！", text)
    text = re.sub(r"([，。！？；：])\1+", r"\1", text)
    if text and text[-1] not in "。！？；：\"'”’）」』】":
        text += "。"
    return collapse_translation_repetitions(text)


def collapse_translation_repetitions(value):
    text = str(value or "").strip()
    for _ in range(6):
        previous = text
        text = re.sub(r"([\u3400-\u9fff]{2,24})(?:[，；、 ]+\1){1,}", r"\1", text)
        text = re.sub(r"([\u3400-\u9fff]{1,12})或\1", r"\1", text)
        text = re.sub(r"(.{2,16}?)(?:\1){2,}", r"\1", text)
        if text == previous:
            break
    return text


def has_chinese(value):
    return bool(re.search(r"[\u3400-\u9fff]", str(value or "")))


class LocalTranslator:
    def __init__(self, model_dir):
        if not (model_dir / "model").exists():
            raise FileNotFoundError(f"Missing local Argos model: {model_dir}")
        self.processor = spm.SentencePieceProcessor(
            model_file=str(model_dir / "sentencepiece.model"),
        )
        self.translator = ctranslate2.Translator(
            str(model_dir / "model"),
            device="cpu",
        )

    def translate_many(self, texts, batch_size):
        encoded = [self.processor.encode(text, out_type=str) for text in texts]
        translated = self.translator.translate_batch(
            encoded,
            beam_size=1,
            num_hypotheses=1,
            replace_unknowns=True,
            max_batch_size=batch_size,
            batch_type="examples",
        )
        return [
            clean_translation(self.processor.decode(item.hypotheses[0]))
            for item in translated
        ]


def translate_missing(cache, texts, translator, batch_size):
    unique = list(dict.fromkeys(text for text in texts if text))
    missing = [text for text in unique if not cache.get(text)]
    for start in range(0, len(missing), batch_size):
        batch = missing[start : start + batch_size]
        outputs = translator.translate_many(batch, batch_size)
        cache.update(dict(zip(batch, outputs)))
        write_json(CACHE_PATH, cache)
        print(
            f"translated {min(start + len(batch), len(missing))}/{len(missing)}",
            flush=True,
        )
    return unique, missing


def main():
    parser = argparse.ArgumentParser(
        description="Translate final IELTS definitions and usage examples locally.",
    )
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    cache = read_json(CACHE_PATH, {})
    texts = [
        text
        for word in words
        for sense in word.get("senses", [])
        for text in (
            str(sense.get("definitionSentence") or sense.get("definition") or "").strip(),
            str(sense.get("example") or "").strip()
            if not sense.get("exampleZh")
            else "",
        )
        if text
    ]
    translator = LocalTranslator(MODEL_DIR)
    unique, missing = translate_missing(cache, texts, translator, args.batch_size)

    missing_definition = []
    missing_example = []
    latin_in_translation = []
    for word in words:
        for sense in word.get("senses", []):
            identity = {"word": word["word"], "senseId": sense.get("id")}
            definition = str(
                sense.get("definitionSentence") or sense.get("definition") or "",
            ).strip()
            example = str(sense.get("example") or "").strip()
            if not sense.get("definitionZh"):
                sense["definitionZh"] = clean_translation(cache.get(definition, ""))
                sense["definitionZhSource"] = "argos-en-zh-local"
            if example and not sense.get("exampleZh"):
                sense["exampleZh"] = clean_translation(cache.get(example, ""))
                sense["exampleZhSource"] = "argos-en-zh-local"
            if not has_chinese(sense.get("definitionZh")):
                missing_definition.append(identity)
            if example and not has_chinese(sense.get("exampleZh")):
                missing_example.append(identity)
            for field in ("definitionZh", "exampleZh"):
                latin = re.findall(r"[A-Za-z]{3,}", str(sense.get(field) or ""))
                if latin:
                    latin_in_translation.append({
                        **identity,
                        "field": field,
                        "terms": latin,
                    })

    report = {
        "words": len(words),
        "senses": sum(len(word.get("senses", [])) for word in words),
        "uniqueTranslatedLines": len(unique),
        "newTranslatedLines": len(missing),
        "missingDefinitionTranslations": missing_definition,
        "missingExampleTranslations": missing_example,
        "latinTermsForReview": latin_in_translation,
    }
    write_json(WORDS_PATH, words)
    write_json(REPORT_PATH, report)
    print(json.dumps({
        "words": report["words"],
        "senses": report["senses"],
        "uniqueTranslatedLines": report["uniqueTranslatedLines"],
        "newTranslatedLines": report["newTranslatedLines"],
        "missingDefinitionTranslations": len(missing_definition),
        "missingExampleTranslations": len(missing_example),
        "latinTermsForReview": len(latin_in_translation),
    }, ensure_ascii=False, indent=2))
    if missing_definition or missing_example:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
