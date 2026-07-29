import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from translation_provider import provider_for, translate_text


ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data" / "kaoyan-words.json"
CACHE_PATH = ROOT / "data" / "argos-en-zh-translation-cache.json"
CONTEXT_OVERRIDES_PATH = ROOT / "data" / "example-translation-overrides.json"
DEFINITION_OVERRIDES_PATH = (
    ROOT / "data" / "definition-example-translation-overrides.json"
)
REPORT_PATH = ROOT / "data" / "bilingual-line-audit.json"
MARKER_RE = re.compile(r"\[SV(\d{6})\]\s*(.*?)(?=\[SV\d{6}\]|\Z)", re.S)


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
    text = str(value or "").strip()
    text = re.sub(r"\s+([，。！？；：、）])", r"\1", text)
    text = re.sub(r"([（])\s+", r"\1", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    if text and text[-1] not in "。！？；：\"'”’）」』】":
        text += "。"
    return text


def translated_text(payload):
    data = json.loads(payload.decode("utf-8"))
    return "".join(part[0] for part in data[0] if part and part[0])


def request_translation(text, timeout):
    return translate_text(text, "en", "zh-CN", timeout=timeout)


def translate_batch(texts, timeout, retries):
    marked = "\n".join(
        f"[SV{index:06d}] {text}" for index, text in enumerate(texts, start=1)
    )
    last_error = None
    for attempt in range(retries):
        try:
            output = request_translation(marked, timeout)
        except Exception as error:
            last_error = error
            time.sleep(min(2**attempt, 8))
            continue

        parsed = {
            int(index): clean_translation(value)
            for index, value in MARKER_RE.findall(output)
        }
        if len(parsed) == len(texts):
            return {text: parsed[index] for index, text in enumerate(texts, start=1)}

        # A bracketed marker can occasionally be absorbed into a translation.
        # Split only that batch until each result can be mapped unambiguously.
        if len(texts) > 1:
            midpoint = len(texts) // 2
            left = translate_batch(texts[:midpoint], timeout, retries)
            right = translate_batch(texts[midpoint:], timeout, retries)
            return {**left, **right}

        for single_attempt in range(retries):
            try:
                return {texts[0]: clean_translation(request_translation(texts[0], timeout))}
            except Exception as error:
                last_error = error
                time.sleep(min(2**single_attempt, 8))
    raise RuntimeError(f"translation batch failed: {last_error}")


def make_batches(texts, batch_size, max_chars):
    batch = []
    length = 0
    for text in texts:
        added = len(text) + 16
        if batch and (len(batch) >= batch_size or length + added > max_chars):
            yield batch
            batch = []
            length = 0
        batch.append(text)
        length += added
    if batch:
        yield batch


def has_chinese(value):
    return bool(re.search(r"[\u3400-\u9fff]", str(value or "")))


def repeated_run(value):
    compact = re.sub(r"\s+", "", str(value or ""))
    return bool(re.search(r"([\u3400-\u9fff])\1{2,}", compact))


def audit(words):
    issues = {}
    checks = {
        "missingDefinitionTranslations": [],
        "missingExampleTranslations": [],
        "definitionTranslationsWithoutChinese": [],
        "exampleTranslationsWithoutChinese": [],
        "suspiciousRepeatedCharacters": [],
    }
    counts = {"words": len(words), "senses": 0}
    for word in words:
        for sense in word.get("senses", []):
            counts["senses"] += 1
            identity = {"word": word["word"], "sense": sense.get("id")}
            definition_zh = str(sense.get("definitionZh", "")).strip()
            example_zh = str(sense.get("exampleZh", "")).strip()
            if not definition_zh:
                checks["missingDefinitionTranslations"].append(identity)
            elif not has_chinese(definition_zh):
                checks["definitionTranslationsWithoutChinese"].append(identity)
            if not example_zh:
                checks["missingExampleTranslations"].append(identity)
            elif not has_chinese(example_zh):
                checks["exampleTranslationsWithoutChinese"].append(identity)
            if repeated_run(definition_zh) or repeated_run(example_zh):
                checks["suspiciousRepeatedCharacters"].append(identity)
    issues = {key: value for key, value in checks.items() if value}
    return {
        "summary": {
            **counts,
            "blockingIssues": sum(len(value) for value in issues.values()),
        },
        "issueCounts": {key: len(value) for key, value in issues.items()},
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Build direct Chinese translations for definition and usage lines"
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=18)
    parser.add_argument("--max-chars", type=int, default=2400)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=5)
    args = parser.parse_args()

    words = read_json(WORDS_PATH, [])
    context_overrides = read_json(CONTEXT_OVERRIDES_PATH, {})
    definition_overrides = read_json(DEFINITION_OVERRIDES_PATH, {})
    cache = read_json(CACHE_PATH, {})

    required = []
    for word in words:
        for sense in word.get("senses", []):
            key = f"{word['word']}|{sense.get('id', '')}"
            if key not in definition_overrides:
                required.append(str(sense.get("definitionSentence", "")).strip())
            if key not in context_overrides:
                required.append(str(sense.get("example", "")).strip())

    unique = list(dict.fromkeys(text for text in required if text))
    missing = [text for text in unique if not cache.get(text)]
    batches = list(make_batches(missing, args.batch_size, args.max_chars))
    print(
        json.dumps(
            {
                "uniqueLines": len(unique),
                "cachedLines": len(unique) - len(missing),
                "missingLines": len(missing),
                "batches": len(batches),
            },
            ensure_ascii=False,
        ),
        flush=True,
    )

    completed = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(
                translate_batch,
                batch,
                args.timeout,
                args.retries,
            ): batch
            for batch in batches
        }
        for future in as_completed(futures):
            cache.update(future.result())
            completed += 1
            if completed % 20 == 0 or completed == len(batches):
                write_json(CACHE_PATH, cache)
                print(f"translated batches {completed}/{len(batches)}", flush=True)

    for word in words:
        for sense in word.get("senses", []):
            key = f"{word['word']}|{sense.get('id', '')}"
            definition = str(sense.get("definitionSentence", "")).strip()
            example = str(sense.get("example", "")).strip()
            if key in definition_overrides:
                sense["definitionZh"] = clean_translation(definition_overrides[key])
                sense["definitionZhSource"] = "human-reviewed"
            else:
                sense["definitionZh"] = clean_translation(cache.get(definition, ""))
                sense["definitionZhSource"] = provider_for("en", "zh-CN")
            if key in context_overrides:
                sense["exampleZh"] = clean_translation(context_overrides[key])
                sense["exampleZhSource"] = "human-reviewed"
            else:
                sense["exampleZh"] = clean_translation(cache.get(example, ""))
                sense["exampleZhSource"] = provider_for("en", "zh-CN")

    report = audit(words)
    write_json(WORDS_PATH, words)
    write_json(REPORT_PATH, report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)
    print(json.dumps(report["issueCounts"], ensure_ascii=False), flush=True)
    if report["summary"]["blockingIssues"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
