"""Reproducible local benchmark for translation and semantic matching."""

from __future__ import annotations

import argparse
import gc
import importlib.util
import json
import os
import platform
import statistics
import subprocess
import sys
import tempfile
import time
from collections import Counter, defaultdict
from importlib.metadata import version as package_version
from pathlib import Path

from batch_content_utils import (
    atomic_write_json,
    peak_rss_bytes,
    read_json,
    sha256_file,
    sha256_json,
    sha256_text,
    utc_now_iso,
)
from content_batch_job import run_translation_job, validate_job
from translation_provider import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_COMPUTE_TYPE,
    DEFAULT_INTER_THREADS,
    DEFAULT_INTRA_THREADS,
    MODEL_DIR,
    LocalBatchTranslator,
    local_model_identity,
)


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FIXTURE = ROOT / "tools" / "fixtures" / "content-batch-translation-v1.json"
DEFAULT_REPORT = ROOT / "artifacts" / "benchmarks" / "content-batch-current.json"
BENCHMARK_SOURCE_FILES = (
    "tools/batch_content_utils.py",
    "tools/translation_provider.py",
    "tools/content_batch_job.py",
    "tools/semantic_example_matching.py",
    "tools/match-ielts-semantic-examples.py",
    "tools/benchmark-content-batch.py",
)


def _processor_name() -> str:
    if os.name != "nt":
        return platform.processor() or "unknown"
    try:
        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return completed.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return platform.processor() or "unknown"


def _git_commit() -> str:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return completed.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def _fixture_identity_audit(fixture: dict) -> dict:
    bundle = read_json(ROOT / "data" / "vocabulary-bundle.json")
    words = {word["id"]: word for word in bundle["words"]}
    checked = 0
    errors = []
    for item in fixture["items"]:
        if not (
            item["sourceText"]
            and item["sourceLanguage"].lower().startswith("en")
            and item["targetLanguage"].lower().startswith("zh")
        ):
            continue
        checked += 1
        word = words.get(item["wordId"])
        sense = next(
            (
                row
                for row in (word or {}).get("senses", [])
                if row.get("id") == item["senseId"]
            ),
            None,
        )
        if (
            word is None
            or sense is None
            or sense.get("pos") != item["pos"]
            or sense.get("example") != item["sourceText"]
        ):
            errors.append(item["itemId"])
    return {
        "checkedItems": checked,
        "mappingErrors": errors,
        "passed": not errors,
    }


def _fixture_coverage(fixture: dict) -> dict:
    valid = [
        item
        for item in fixture["items"]
        if item["sourceText"]
        and item["sourceLanguage"].lower().startswith("en")
        and item["targetLanguage"].lower().startswith("zh")
    ]
    text_counts = Counter(item["sourceText"] for item in valid)
    senses_by_word = defaultdict(set)
    for item in valid:
        senses_by_word[item["wordId"]].add(item["senseId"])
    word_counts = [len(item["sourceText"].split()) for item in valid]
    return {
        "validItems": len(valid),
        "invalidItems": len(fixture["items"]) - len(valid),
        "uniqueTexts": len(text_counts),
        "duplicateTextGroups": sum(count > 1 for count in text_counts.values()),
        "polysemousWordIds": sum(
            len(sense_ids) > 1 for sense_ids in senses_by_word.values()
        ),
        "shortestWords": min(word_counts),
        "longestWords": max(word_counts),
    }


def _translation_benchmark(
    fixture: dict,
    *,
    model_dir: Path,
    batch_size: int,
    inter_threads: int,
    intra_threads: int,
    repeats: int,
) -> dict:
    valid_items = [
        item
        for item in fixture["items"]
        if item["sourceText"]
        and item["sourceLanguage"].lower().startswith("en")
        and item["targetLanguage"].lower().startswith("zh")
    ]
    texts = [item["sourceText"] for item in valid_items]
    engine = LocalBatchTranslator(
        model_dir,
        inter_threads=inter_threads,
        intra_threads=intra_threads,
        compute_type=DEFAULT_COMPUTE_TYPE,
        decode_options=fixture["decodeOptions"],
    )
    processor = engine.processor
    translator = engine.translator
    encoded = [processor.encode(text, out_type=str) for text in texts]

    def decode(result) -> str:
        return processor.decode(result.hypotheses[0]).replace("\u2581", " ").strip()

    translator.translate_batch(
        [encoded[0]],
        max_batch_size=1,
        batch_type="examples",
        **fixture["decodeOptions"],
    )
    runs = []
    last_serial = []
    last_batch = []
    for repeat in range(repeats):
        started = time.perf_counter()
        serial = [
            decode(
                translator.translate_batch(
                    [tokens],
                    max_batch_size=1,
                    batch_type="examples",
                    **fixture["decodeOptions"],
                )[0]
            )
            for tokens in encoded
        ]
        serial_seconds = time.perf_counter() - started

        started = time.perf_counter()
        batch = [
            decode(result)
            for result in translator.translate_batch(
                encoded,
                max_batch_size=batch_size,
                batch_type="examples",
                **fixture["decodeOptions"],
            )
        ]
        batch_seconds = time.perf_counter() - started
        runs.append(
            {
                "repeat": repeat + 1,
                "serialSeconds": round(serial_seconds, 6),
                "batchSeconds": round(batch_seconds, 6),
                "speedup": round(serial_seconds / batch_seconds, 6),
                "serialItemsPerSecond": round(len(texts) / serial_seconds, 6),
                "batchItemsPerSecond": round(len(texts) / batch_seconds, 6),
                "outputMismatchCount": sum(
                    left != right for left, right in zip(serial, batch)
                ),
            }
        )
        last_serial = serial
        last_batch = batch

    median_speedup = float(statistics.median(run["speedup"] for run in runs))
    mismatches = [
        {
            "index": index,
            "itemId": valid_items[index]["itemId"],
            "serialSha256": sha256_text(serial),
            "batchSha256": sha256_text(batch),
        }
        for index, (serial, batch) in enumerate(zip(last_serial, last_batch))
        if serial != batch
    ]
    return {
        "items": len(texts),
        "uniqueTexts": len(set(texts)),
        "modelColdStartMs": round(engine.cold_start_ms, 3),
        "batchSize": batch_size,
        "interThreads": inter_threads,
        "intraThreads": intra_threads,
        "computeType": DEFAULT_COMPUTE_TYPE,
        "decodeOptions": fixture["decodeOptions"],
        "runs": runs,
        "medianSpeedup": round(median_speedup, 6),
        "speedTarget": 1.5,
        "speedTargetMet": median_speedup >= 1.5,
        "mappingOrderPreserved": len(last_batch) == len(texts),
        "serialOutputListSha256": sha256_json(last_serial),
        "batchOutputListSha256": sha256_json(last_batch),
        "outputMismatchCount": len(mismatches),
        "outputMismatches": mismatches,
    }


def _translation_tuning(
    fixture: dict,
    *,
    model_dir: Path,
    repeats: int,
) -> dict:
    valid_items = [
        item
        for item in fixture["items"]
        if item["sourceText"]
        and item["sourceLanguage"].lower().startswith("en")
        and item["targetLanguage"].lower().startswith("zh")
    ]
    texts = list(dict.fromkeys(item["sourceText"] for item in valid_items))
    thread_configs = [(1, 8), (2, 4), (4, 2)]
    batch_sizes = [4, 8, 16, 24]
    rows = []
    for inter_threads, intra_threads in thread_configs:
        engine = LocalBatchTranslator(
            model_dir,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
            compute_type=DEFAULT_COMPUTE_TYPE,
            decode_options=fixture["decodeOptions"],
        )
        processor = engine.processor
        translator = engine.translator
        encoded = [processor.encode(text, out_type=str) for text in texts]
        translator.translate_batch(
            [encoded[0]],
            max_batch_size=1,
            batch_type="examples",
            **fixture["decodeOptions"],
        )
        for batch_size in batch_sizes:
            seconds = []
            for _ in range(repeats):
                started = time.perf_counter()
                results = translator.translate_batch(
                    encoded,
                    max_batch_size=batch_size,
                    batch_type="examples",
                    **fixture["decodeOptions"],
                )
                elapsed = time.perf_counter() - started
                if len(results) != len(texts):
                    raise RuntimeError("Tuning output count mismatch")
                seconds.append(elapsed)
            median_seconds = statistics.median(seconds)
            rows.append(
                {
                    "interThreads": inter_threads,
                    "intraThreads": intra_threads,
                    "batchSize": batch_size,
                    "runsSeconds": [round(value, 6) for value in seconds],
                    "medianSeconds": round(median_seconds, 6),
                    "medianItemsPerSecond": round(len(texts) / median_seconds, 6),
                }
            )
        del translator
        del engine
        gc.collect()
    fastest = max(rows, key=lambda row: row["medianItemsPerSecond"])
    selected = next(
        row
        for row in rows
        if row["interThreads"] == DEFAULT_INTER_THREADS
        and row["intraThreads"] == DEFAULT_INTRA_THREADS
        and row["batchSize"] == DEFAULT_BATCH_SIZE
    )
    return {
        "items": len(texts),
        "repeats": repeats,
        "rows": rows,
        "fastest": fastest,
        "selectedDefault": selected,
        "selectedVsFastestRatio": round(
            selected["medianItemsPerSecond"] / fastest["medianItemsPerSecond"],
            6,
        ),
        "selectionPolicy": (
            "Use all 8 logical CPUs without oversubscription; choose the best "
            "measured batch among 4, 8, 16, and 24. Larger batches are not "
            "assumed faster without a new benchmark."
        ),
    }


def _structured_job_benchmark(
    fixture: dict,
    *,
    model_dir: Path,
    batch_size: int,
    inter_threads: int,
    intra_threads: int,
) -> dict:
    with tempfile.TemporaryDirectory(prefix="sense-vocab-job-benchmark-") as directory:
        root = Path(directory)
        input_path = root / "job.json"
        cache_path = root / "cache.json"
        first_output = root / "first.json"
        second_output = root / "second.json"
        atomic_write_json(input_path, fixture)
        first = run_translation_job(
            input_path,
            first_output,
            cache_path=cache_path,
            model_dir=model_dir,
            batch_size=batch_size,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )
        second = run_translation_job(
            input_path,
            second_output,
            cache_path=cache_path,
            model_dir=model_dir,
            batch_size=batch_size,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )

        valid_items = [
            item
            for item in fixture["items"]
            if item["sourceText"]
            and item["sourceLanguage"].lower().startswith("en")
            and item["targetLanguage"].lower().startswith("zh")
        ]
        resume_fixture = {
            **fixture,
            "jobId": f"{fixture['jobId']}-resume",
            "rulesVersion": f"{fixture['rulesVersion']}-resume",
            "items": valid_items[:6],
        }
        resume_input = root / "resume-job.json"
        resume_output = root / "resume-output.json"
        resume_cache = root / "resume-cache.json"
        atomic_write_json(resume_input, resume_fixture)
        interrupted = None
        try:
            run_translation_job(
                resume_input,
                resume_output,
                cache_path=resume_cache,
                model_dir=model_dir,
                batch_size=2,
                inter_threads=inter_threads,
                intra_threads=intra_threads,
                interrupt_after_checkpoints=1,
            )
        except KeyboardInterrupt:
            interrupted = read_json(resume_output)
        if interrupted is None or interrupted.get("status") != "interrupted":
            raise RuntimeError("Structured job interruption checkpoint was not recorded")
        resumed = run_translation_job(
            resume_input,
            resume_output,
            cache_path=resume_cache,
            model_dir=model_dir,
            batch_size=2,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )

        invalid_errors = {
            item["itemId"]: item["error"]["code"]
            for item in first["items"]
            if item["status"] == "failed"
        }
        successful_output_hashes_match = all(
            left.get("outputSha256") == right.get("outputSha256")
            for left, right in zip(first["items"], second["items"])
            if left["status"] == right["status"] == "success"
        )
        return {
            "firstRun": {
                "status": first["status"],
                "summary": first["summary"],
                "metrics": first["metrics"],
                "invalidErrors": invalid_errors,
            },
            "unchangedRerun": {
                "status": second["status"],
                "summary": second["summary"],
                "metrics": second["metrics"],
                "modelWasLoaded": "coldStartMs" in second["metrics"],
                "successfulOutputHashesMatch": successful_output_hashes_match,
            },
            "interruption": {
                "checkpointStatus": interrupted["status"],
                "checkpointSummary": interrupted["summary"],
                "checkpointMetrics": interrupted["metrics"],
                "resumeStatus": resumed["status"],
                "resumeSummary": resumed["summary"],
                "resumeMetrics": resumed["metrics"],
                "completedOutputHashesValid": all(
                    item["status"] != "success"
                    or sha256_text(item["output"]) == item["outputSha256"]
                    for item in resumed["items"]
                ),
            },
        }


def _legacy_scores(senses, candidates, vectors, wordnet_examples, lexical_overlap):
    import numpy as np

    scores = np.zeros((len(senses), len(candidates)), dtype=np.float64)
    contrasts = np.zeros_like(scores)
    for sense_index, sense in enumerate(senses):
        definition_vector = vectors[sense["definition"]]
        examples = wordnet_examples(sense)
        example_vectors = [
            vectors[example] for example in examples if example in vectors
        ]
        for candidate_index, candidate in enumerate(candidates):
            sentence_vector = vectors[candidate["text"]]
            sentence_similarity = float(np.dot(definition_vector, sentence_vector))
            anchor_similarity = sentence_similarity
            if candidate["anchor"] in vectors:
                anchor_similarity = float(
                    np.dot(definition_vector, vectors[candidate["anchor"]])
                )
            wordnet_similarity = (
                max(float(np.dot(sentence_vector, value)) for value in example_vectors)
                if example_vectors
                else sentence_similarity
            )
            score = (
                0.43 * sentence_similarity
                + 0.47 * anchor_similarity
                + 0.10 * wordnet_similarity
            )
            score += min(
                0.055,
                lexical_overlap(
                    f"{sense['definition']} {' '.join(examples)}",
                    f"{candidate['anchor']} {candidate['text']}",
                )
                * 0.08,
            )
            if (
                candidate["metadata"].get("exactSynsetId")
                and candidate["metadata"]["exactSynsetId"] == sense.get("synsetId")
            ):
                score += 0.14
            if candidate["source"].startswith("semantic-kaikki"):
                score += 0.015
            if len(candidate["text"].split()) >= 9:
                score += 0.01
            other_scores = []
            for other_index, other in enumerate(senses):
                if other_index == sense_index:
                    continue
                other_vector = vectors[other["definition"]]
                other_sentence = float(np.dot(other_vector, sentence_vector))
                other_anchor = (
                    float(np.dot(other_vector, vectors[candidate["anchor"]]))
                    if candidate["anchor"] in vectors
                    else other_sentence
                )
                other_scores.append(0.48 * other_sentence + 0.52 * other_anchor)
            scores[sense_index, candidate_index] = score
            contrasts[sense_index, candidate_index] = score - max(
                other_scores, default=0.0
            )
    return scores, contrasts


def _semantic_benchmark() -> dict:
    import numpy as np

    from semantic_example_matching import score_candidate_matrix

    rng = np.random.default_rng(20260812)
    sense_count = 128
    candidate_count = 256
    width = 384

    def unit() -> np.ndarray:
        vector = rng.normal(size=width).astype(np.float32)
        return vector / np.linalg.norm(vector)

    senses = [
        {
            "id": f"sense-{index}",
            "definition": f"definition {index}",
            "synsetId": f"synset-{index}",
        }
        for index in range(sense_count)
    ]
    candidates = [
        {
            "text": f"candidate sentence {index} with enough words for scoring",
            "anchor": f"anchor {index}",
            "source": (
                "semantic-kaikki-wiktionary" if index % 3 == 0 else "semantic-tatoeba"
            ),
            "metadata": {
                "exactSynsetId": (
                    f"synset-{index % sense_count}" if index % 11 == 0 else None
                )
            },
        }
        for index in range(candidate_count)
    ]
    wordnet = {
        sense["id"]: [f"wordnet {index} a", f"wordnet {index} b"]
        for index, sense in enumerate(senses)
    }
    texts = [sense["definition"] for sense in senses]
    texts += [candidate["text"] for candidate in candidates]
    texts += [candidate["anchor"] for candidate in candidates]
    texts += [text for examples in wordnet.values() for text in examples]
    vectors = {text: unit() for text in texts}

    def examples(sense):
        return wordnet[sense["id"]]

    def lexical(left, right):
        left_tokens = set(left.split())
        right_tokens = set(right.split())
        return (
            len(left_tokens & right_tokens)
            / np.sqrt(len(left_tokens) * len(right_tokens))
            if left_tokens and right_tokens
            else 0.0
        )

    started = time.perf_counter()
    legacy_score, legacy_contrast = _legacy_scores(
        senses,
        candidates,
        vectors,
        examples,
        lexical,
    )
    legacy_seconds = time.perf_counter() - started

    started = time.perf_counter()
    vectorized = score_candidate_matrix(
        senses,
        candidates,
        vectors,
        synset_example_lookup=examples,
        lexical_overlap=lexical,
    )
    vectorized_seconds = time.perf_counter() - started
    score_delta = float(np.max(np.abs(legacy_score - vectorized["score"])))
    contrast_delta = float(
        np.max(np.abs(legacy_contrast - vectorized["contrast"]))
    )
    legacy_rank = np.argsort(-legacy_score, axis=1, kind="stable")
    vectorized_rank = np.argsort(-vectorized["score"], axis=1, kind="stable")
    return {
        "senses": sense_count,
        "candidates": candidate_count,
        "embeddingWidth": width,
        "legacySeconds": round(legacy_seconds, 6),
        "vectorizedSeconds": round(vectorized_seconds, 6),
        "speedup": round(legacy_seconds / vectorized_seconds, 6),
        "maxScoreDelta": score_delta,
        "maxContrastDelta": contrast_delta,
        "tolerance": 1e-6,
        "withinTolerance": score_delta <= 1e-6 and contrast_delta <= 1e-6,
        "rankingIdentical": bool(np.array_equal(legacy_rank, vectorized_rank)),
        "peakRssBytes": peak_rss_bytes(),
        "realSample": _semantic_real_sample(),
    }


def _semantic_real_sample() -> dict:
    import numpy as np
    from fastembed import TextEmbedding

    from semantic_example_matching import (
        embed_texts_with_cache,
        fastembed_model_identity,
        score_candidate_matrix,
    )

    matcher_path = ROOT / "tools" / "match-ielts-semantic-examples.py"
    spec = importlib.util.spec_from_file_location("benchmark_matcher", matcher_path)
    matcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(matcher)

    bundle = read_json(ROOT / "data" / "vocabulary-bundle.json")
    tasks = []
    stable_ids = []
    texts = set()
    for word in bundle["words"]:
        senses = [
            sense
            for sense in word.get("senses", [])
            if sense.get("definition") and sense.get("example")
        ]
        if len(senses) < 2:
            continue
        candidates = [
            {
                "text": sense["example"],
                "anchor": sense["definition"],
                "source": sense.get("exampleSource") or "runtime-vocabulary",
                "metadata": {"exactSynsetId": sense.get("synsetId")},
            }
            for sense in senses
        ]
        tasks.append((senses, candidates))
        stable_ids.extend(
            {"wordId": word["id"], "senseId": sense["id"]}
            for sense in senses
        )
        for sense in senses:
            texts.add(sense["definition"])
            texts.add(sense["example"])
        if len(tasks) >= 32:
            break

    model_started = time.perf_counter()
    model = TextEmbedding(
        model_name=matcher.MODEL_NAME,
        cache_dir=str(matcher.MODEL_CACHE),
        local_files_only=True,
    )
    model_load_ms = (time.perf_counter() - model_started) * 1000
    model_identity = fastembed_model_identity(model, matcher.MODEL_NAME)
    with tempfile.TemporaryDirectory(
        prefix="sense-vocab-real-embedding-benchmark-"
    ) as directory:
        cache_path = Path(directory) / "vectors.npz"
        vectors, first_embedding = embed_texts_with_cache(
            model,
            texts,
            cache_path=cache_path,
            model_identity=model_identity,
            batch_size=512,
        )
        _, second_embedding = embed_texts_with_cache(
            model,
            texts,
            cache_path=cache_path,
            model_identity=model_identity,
            batch_size=512,
        )

    legacy_started = time.perf_counter()
    legacy_rows = []
    scoring_repeats = 100
    for repeat in range(scoring_repeats):
        current_rows = []
        for senses, candidates in tasks:
            current_rows.append(
                _legacy_scores(
                    senses,
                    candidates,
                    vectors,
                    lambda sense: [sense["example"]],
                    matcher.lexical_overlap,
                )
            )
        if repeat == 0:
            legacy_rows = current_rows
    legacy_seconds = time.perf_counter() - legacy_started

    vectorized_started = time.perf_counter()
    vectorized_rows = []
    for repeat in range(scoring_repeats):
        current_rows = []
        for senses, candidates in tasks:
            current_rows.append(
                score_candidate_matrix(
                    senses,
                    candidates,
                    vectors,
                    synset_example_lookup=lambda sense: [sense["example"]],
                    lexical_overlap=matcher.lexical_overlap,
                )
            )
        if repeat == 0:
            vectorized_rows = current_rows
    vectorized_seconds = time.perf_counter() - vectorized_started

    score_delta = 0.0
    contrast_delta = 0.0
    ranking_identical = True
    for (legacy_score, legacy_contrast), vectorized in zip(
        legacy_rows,
        vectorized_rows,
    ):
        score_delta = max(
            score_delta,
            float(np.max(np.abs(legacy_score - vectorized["score"]))),
        )
        contrast_delta = max(
            contrast_delta,
            float(np.max(np.abs(legacy_contrast - vectorized["contrast"]))),
        )
        ranking_identical = ranking_identical and bool(
            np.array_equal(
                np.argsort(-legacy_score, axis=1, kind="stable"),
                np.argsort(-vectorized["score"], axis=1, kind="stable"),
            )
        )
    return {
        "runtimeWordGroups": len(tasks),
        "runtimeSenses": len(stable_ids),
        "scoringRepeats": scoring_repeats,
        "stableIdentitySha256": sha256_json(stable_ids),
        "modelLoadMs": round(model_load_ms, 3),
        "modelIdentity": model_identity,
        "firstEmbedding": first_embedding,
        "unchangedEmbeddingRerun": second_embedding,
        "legacySeconds": round(legacy_seconds, 6),
        "vectorizedSeconds": round(vectorized_seconds, 6),
        "speedup": round(legacy_seconds / vectorized_seconds, 6),
        "maxScoreDelta": score_delta,
        "maxContrastDelta": contrast_delta,
        "tolerance": 1e-6,
        "withinTolerance": score_delta <= 1e-6 and contrast_delta <= 1e-6,
        "rankingIdentical": ranking_identical,
        "peakRssBytes": peak_rss_bytes(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--inter-threads", type=int, default=DEFAULT_INTER_THREADS)
    parser.add_argument("--intra-threads", type=int, default=DEFAULT_INTRA_THREADS)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--tuning-repeats", type=int, default=2)
    parser.add_argument(
        "--stage",
        choices=("full", "semantic"),
        default="full",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--stage-output", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.batch_size < 1 or args.repeats < 1 or args.tuning_repeats < 1:
        parser.error("batch size and repeat counts must be positive")

    if args.stage == "semantic":
        if args.stage_output is None:
            parser.error("--stage-output is required for an internal semantic stage")
        semantic = _semantic_benchmark()
        atomic_write_json(args.stage_output, semantic)
        return (
            0
            if semantic["withinTolerance"]
            and semantic["rankingIdentical"]
            and semantic["realSample"]["withinTolerance"]
            and semantic["realSample"]["rankingIdentical"]
            else 1
        )

    fixture = validate_job(read_json(args.fixture))
    fixture_identity = _fixture_identity_audit(fixture)
    if not fixture_identity["passed"]:
        raise RuntimeError(
            "Benchmark fixture no longer matches stable runtime content identities"
        )
    started = time.perf_counter()
    translation = _translation_benchmark(
        fixture,
        model_dir=args.model_dir,
        batch_size=args.batch_size,
        inter_threads=args.inter_threads,
        intra_threads=args.intra_threads,
        repeats=args.repeats,
    )
    tuning = _translation_tuning(
        fixture,
        model_dir=args.model_dir,
        repeats=args.tuning_repeats,
    )
    structured_job = _structured_job_benchmark(
        fixture,
        model_dir=args.model_dir,
        batch_size=args.batch_size,
        inter_threads=args.inter_threads,
        intra_threads=args.intra_threads,
    )
    with tempfile.TemporaryDirectory(prefix="sense-vocab-benchmark-") as directory:
        semantic_path = Path(directory) / "semantic.json"
        completed = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve()),
                "--stage",
                "semantic",
                "--stage-output",
                str(semantic_path),
            ],
            cwd=ROOT,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"Semantic benchmark subprocess failed with code {completed.returncode}"
            )
        semantic = read_json(semantic_path)
    report = {
        "schemaVersion": 1,
        "kind": "sense-vocab-content-batch-benchmark",
        "generatedAt": utc_now_iso(),
        "machine": {
            "processor": _processor_name(),
            "logicalCpus": os.cpu_count(),
            "platform": platform.platform(),
            "python": platform.python_version(),
            "packages": {
                name: package_version(name)
                for name in (
                    "ctranslate2",
                    "sentencepiece",
                    "fastembed",
                    "numpy",
                    "nltk",
                )
            },
        },
        "implementation": {
            "gitCommit": _git_commit(),
            "fileSha256": {
                relative: sha256_file(ROOT / relative)
                for relative in BENCHMARK_SOURCE_FILES
            },
        },
        "fixture": {
            "path": args.fixture.relative_to(ROOT).as_posix(),
            "sha256": sha256_file(args.fixture),
            "items": len(fixture["items"]),
            "identityAudit": fixture_identity,
            "coverage": _fixture_coverage(fixture),
        },
        "model": local_model_identity(args.model_dir),
        "command": (
            "py tools/benchmark-content-batch.py "
            f"--batch-size {args.batch_size} "
            f"--inter-threads {args.inter_threads} "
            f"--intra-threads {args.intra_threads} "
            f"--repeats {args.repeats} "
            f"--tuning-repeats {args.tuning_repeats}"
        ),
        "translation": translation,
        "translationTuning": tuning,
        "structuredJob": structured_job,
        "semanticScoring": semantic,
        "totalSeconds": round(time.perf_counter() - started, 6),
        "peakRssBytes": peak_rss_bytes(),
    }
    atomic_write_json(args.output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if translation["speedTargetMet"] and semantic["withinTolerance"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
